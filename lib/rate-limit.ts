/**
 * lib/rate-limit.ts — Rate limiter serveur, in-memory
 *
 * Architecture :
 *   - Store: Map en mémoire (reset sur redémarrage serveur / cold start Vercel)
 *   - Identification: IP (x-forwarded-for > x-real-ip > cf-connecting-ip > user-agent fallback)
 *   - Fenêtres: horaire (reset au prochain HH:00:00 UTC) + journalière (reset à minuit UTC)
 *   - Sécurité: toutes les fonctions sont try/catch — une erreur du rate limiter
 *     ne bloque JAMAIS l'application
 *
 * Futur Supabase/Upstash :
 *   Remplacer resolveBucket() + setBucket() par des calls Redis/Postgres.
 *   L'API publique (checkRateLimit, recordUsage, recordBlock) ne change pas.
 *
 * Futur Premium :
 *   Passer tier: 'premium' à checkRateLimit() → quotas × PREMIUM_MULTIPLIER.
 *   Ne rien changer d'autre.
 */

import { type NextRequest } from 'next/server'

// ─── Types publics ─────────────────────────────────────────────────────────────
export type RateLimitedRoute = 'correct-homework' | 'generate-questions' | 'check-answers'
export type UserTier = 'free' | 'premium'

export interface RateLimitResult {
  allowed: boolean
  identifier: string
  remaining: { hourly: number; daily: number }
  resetAt: { hourly: number; daily: number }
  limitType?: 'hourly' | 'daily'
}

export interface AbuseEvent {
  timestamp: number       // Unix ms
  identifier: string      // IP masquée (derniers 3 octets visibles)
  route: RateLimitedRoute
  limitType: 'hourly' | 'daily'
  count: number           // valeur du compteur au moment du blocage
  limit: number           // seuil configuré
}

export interface RouteCounters {
  blocked: number
  allowed: number
}

export interface RateLimitStats {
  totalBlocked: number
  byRoute: Record<RateLimitedRoute, RouteCounters>
  recentEvents: AbuseEvent[]     // 20 derniers, du plus récent au plus ancien
  topAbusers: { identifier: string; count: number }[]  // top 5
  uptimeMs: number               // ms depuis le démarrage du serveur
  storeSize: number              // nb de clés actives en mémoire
}

// ─── Config limites MVP ────────────────────────────────────────────────────────
interface RouteConfig {
  hourlyLimit: number
  dailyLimit: number
}

// Ajuster ici sans toucher au reste du code
export const BASE_LIMITS: Record<RateLimitedRoute, RouteConfig> = {
  'correct-homework':   { hourlyLimit: 30,  dailyLimit: 100 },
  'generate-questions': { hourlyLimit: 20,  dailyLimit: 50  },
  'check-answers':      { hourlyLimit: 50,  dailyLimit: 150 },
}

const PREMIUM_MULTIPLIER = 5  // activé quand le paywall est implémenté

function getConfig(route: RateLimitedRoute, tier: UserTier): RouteConfig {
  const base = BASE_LIMITS[route]
  if (tier === 'premium') {
    return {
      hourlyLimit: base.hourlyLimit * PREMIUM_MULTIPLIER,
      dailyLimit:  base.dailyLimit  * PREMIUM_MULTIPLIER,
    }
  }
  return base
}

// ─── Store in-memory ──────────────────────────────────────────────────────────
interface WindowState {
  count: number
  resetAt: number  // Unix ms
}

interface RateLimitBucket {
  hourly: WindowState
  daily: WindowState
}

const store = new Map<string, RateLimitBucket>()
const SERVER_START = Date.now()

// Compteurs admin
const MAX_ABUSE_LOG = 100
const abuseLog: AbuseEvent[] = []
const abuseCounts = new Map<string, number>()   // identifier → total blocages

const routeCounters: Record<RateLimitedRoute, RouteCounters> = {
  'correct-homework':   { blocked: 0, allowed: 0 },
  'generate-questions': { blocked: 0, allowed: 0 },
  'check-answers':      { blocked: 0, allowed: 0 },
}

// ─── Fenêtres temporelles ──────────────────────────────────────────────────────
function nextHourBoundary(): number {
  const now = Date.now()
  return now + (3_600_000 - (now % 3_600_000))
}

function nextMidnightUTC(): number {
  const d = new Date()
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
}

function freshBucket(): RateLimitBucket {
  return {
    hourly: { count: 0, resetAt: nextHourBoundary() },
    daily:  { count: 0, resetAt: nextMidnightUTC()  },
  }
}

/** Récupère le bucket et réinitialise automatiquement les fenêtres expirées. */
function resolveBucket(key: string): RateLimitBucket {
  try {
    const b = store.get(key)
    const now = Date.now()
    if (!b) return freshBucket()

    return {
      hourly: b.hourly.resetAt > now ? b.hourly : { count: 0, resetAt: nextHourBoundary() },
      daily:  b.daily.resetAt  > now ? b.daily  : { count: 0, resetAt: nextMidnightUTC()  },
    }
  } catch {
    return freshBucket()
  }
}

// ─── Masquage IP pour les logs ────────────────────────────────────────────────
/** Masque les premiers octets d'une IP pour les logs admin. Ex: "193.168.**.1" */
function maskIdentifier(id: string): string {
  // IPv4
  const v4 = id.match(/^(\d{1,3}\.\d{1,3})\.(\d{1,3}\.\d{1,3})$/)
  if (v4) return `${v4[1]}.**.**`
  // IPv6 partiel
  if (id.includes(':')) return id.slice(0, 8) + '...'
  return id.slice(0, 6) + '***'
}

// ─── Extraction identifiant ───────────────────────────────────────────────────
/**
 * Priorité : x-forwarded-for > x-real-ip > cf-connecting-ip > user-agent[:32]
 * Retourne toujours une chaîne non vide.
 */
export function extractIdentifier(req: NextRequest): string {
  try {
    const fwd = req.headers.get('x-forwarded-for')
    if (fwd) return fwd.split(',')[0].trim()

    const real = req.headers.get('x-real-ip')
    if (real) return real.trim()

    const cf = req.headers.get('cf-connecting-ip')
    if (cf) return cf.trim()

    const ua = req.headers.get('user-agent') ?? ''
    if (ua) return 'ua:' + ua.slice(0, 32).replace(/\s+/g, '_')

    return 'unknown'
  } catch {
    return 'unknown'
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Vérifie si la requête est autorisée sans incrémenter le compteur.
 * Appeler recordUsage() séparément si la requête réussit.
 */
export function checkRateLimit(
  identifier: string,
  route: RateLimitedRoute,
  tier: UserTier = 'free'
): RateLimitResult {
  try {
    const config = getConfig(route, tier)
    const key = `${route}:${identifier}`
    const bucket = resolveBucket(key)

    const hourlyOk = bucket.hourly.count < config.hourlyLimit
    const dailyOk  = bucket.daily.count  < config.dailyLimit
    const allowed  = hourlyOk && dailyOk

    return {
      allowed,
      identifier,
      remaining: {
        hourly: Math.max(0, config.hourlyLimit - bucket.hourly.count),
        daily:  Math.max(0, config.dailyLimit  - bucket.daily.count),
      },
      resetAt: {
        hourly: bucket.hourly.resetAt,
        daily:  bucket.daily.resetAt,
      },
      limitType: !hourlyOk ? 'hourly' : !dailyOk ? 'daily' : undefined,
    }
  } catch {
    // Ne jamais bloquer l'application sur une erreur du rate limiter
    return {
      allowed: true,
      identifier,
      remaining: { hourly: 999, daily: 999 },
      resetAt:   { hourly: 0, daily: 0 },
    }
  }
}

/**
 * Incrémente les compteurs horaire et journalier après une requête réussie.
 * À appeler APRÈS que l'appel OpenAI ait réussi (ou juste avant — au choix).
 */
export function recordUsage(identifier: string, route: RateLimitedRoute): void {
  try {
    const key = `${route}:${identifier}`
    const bucket = resolveBucket(key)
    bucket.hourly.count++
    bucket.daily.count++
    store.set(key, bucket)
    routeCounters[route].allowed++
  } catch { /* silent */ }
}

/**
 * Enregistre un événement de blocage dans les logs admin.
 * À appeler quand checkRateLimit() retourne allowed: false.
 */
export function recordBlock(
  identifier: string,
  route: RateLimitedRoute,
  limitType: 'hourly' | 'daily',
  count: number,
  limit: number
): void {
  try {
    routeCounters[route].blocked++

    const prev = abuseCounts.get(identifier) ?? 0
    abuseCounts.set(identifier, prev + 1)

    abuseLog.push({
      timestamp: Date.now(),
      identifier: maskIdentifier(identifier),
      route,
      limitType,
      count,
      limit,
    })
    if (abuseLog.length > MAX_ABUSE_LOG) abuseLog.shift()
  } catch { /* silent */ }
}

/**
 * Retourne les statistiques complètes pour le dashboard admin.
 */
export function getRateLimitStats(): RateLimitStats {
  try {
    const totalBlocked = Object.values(routeCounters).reduce((s, r) => s + r.blocked, 0)

    const topAbusers = Array.from(abuseCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([identifier, count]) => ({ identifier: maskIdentifier(identifier), count }))

    return {
      totalBlocked,
      byRoute: {
        'correct-homework':   { ...routeCounters['correct-homework']   },
        'generate-questions': { ...routeCounters['generate-questions'] },
        'check-answers':      { ...routeCounters['check-answers']      },
      },
      recentEvents: [...abuseLog].reverse().slice(0, 20),
      topAbusers,
      uptimeMs:  Date.now() - SERVER_START,
      storeSize: store.size,
    }
  } catch {
    return {
      totalBlocked: 0,
      byRoute: {
        'correct-homework':   { blocked: 0, allowed: 0 },
        'generate-questions': { blocked: 0, allowed: 0 },
        'check-answers':      { blocked: 0, allowed: 0 },
      },
      recentEvents: [],
      topAbusers:   [],
      uptimeMs:     0,
      storeSize:    0,
    }
  }
}

/**
 * Nettoyage optionnel — supprime les buckets dont les deux fenêtres sont expirées.
 * Peut être appelé périodiquement pour éviter une fuite mémoire en production longue.
 */
export function pruneStore(): number {
  let pruned = 0
  const now = Date.now()
  for (const [key, bucket] of Array.from(store.entries())) {
    if (bucket.hourly.resetAt < now && bucket.daily.resetAt < now) {
      store.delete(key)
      pruned++
    }
  }
  return pruned
}
