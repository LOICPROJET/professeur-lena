/**
 * lib/rate-limit-redis.ts — Rate limiter hybride (Upstash Redis ↔ in-memory)
 *
 * Architecture hybride :
 *   ✅ UPSTASH_REDIS_REST_URL définie → Upstash Redis (sliding window, atomique, cross-instance)
 *   ✅ Sinon → fallback automatique vers lib/rate-limit.ts (in-memory, MVP)
 *
 * Avantages Redis :
 *   - Atomique : pas de race condition entre Lambda instances Vercel
 *   - Sliding window : élimine l'attaque de frontière (30 req dans les 60 dernières min)
 *   - Persistent : survit aux cold starts
 *
 * ⚠️ INVARIANTS (ne JAMAIS modifier) :
 *   - Aucun prompt modifié
 *   - Aucune logique pédagogique modifiée
 *   - Aucune UX enfant modifiée
 *   - Aucun flux existant cassé
 *
 * Activation :
 *   Ajouter dans .env.local (ou Vercel dashboard) :
 *     UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *     UPSTASH_REDIS_REST_TOKEN=AXxx...
 *   Sans ces variables → comportement identique au Sprint 9 (in-memory).
 *
 * Usage dans les routes API :
 *   import { extractIdentifier, checkRateLimit, recordUsage, recordBlock, BASE_LIMITS } from '@/lib/rate-limit-redis'
 *   const rl = await checkRateLimit(identifier, 'correct-homework')  // ← await obligatoire
 */

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ─── Re-exports depuis le module in-memory ─────────────────────────────────────
// Ces exports sont identiques quelle que soit la stratégie active.
export {
  type RateLimitedRoute,
  type UserTier,
  type RateLimitResult,
  type AbuseEvent,
  type RouteCounters,
  type RateLimitStats,
  BASE_LIMITS,
  extractIdentifier,
  recordBlock,
  getRateLimitStats,
  pruneStore,
} from './rate-limit'

// ─── Détection de la configuration Redis ──────────────────────────────────────
const REDIS_CONFIGURED =
  typeof process.env.UPSTASH_REDIS_REST_URL === 'string' &&
  process.env.UPSTASH_REDIS_REST_URL.length > 0 &&
  typeof process.env.UPSTASH_REDIS_REST_TOKEN === 'string' &&
  process.env.UPSTASH_REDIS_REST_TOKEN.length > 0

// ─── Types locaux ──────────────────────────────────────────────────────────────
import type { RateLimitedRoute, RateLimitResult } from './rate-limit'

// ─── Initialisation Redis (lazy, singleton par instance Lambda) ───────────────
let _redis: Redis | null = null
let _limiters: Record<RateLimitedRoute, { hourly: Ratelimit; daily: Ratelimit }> | null = null

function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv()
  }
  return _redis
}

/**
 * Crée les 6 limiters Upstash (2 par route : horaire + journalier).
 * Sliding window : 30 req dans les 60 dernières minutes (pas juste la fenêtre fixe).
 */
function getLimiters(): Record<RateLimitedRoute, { hourly: Ratelimit; daily: Ratelimit }> {
  if (_limiters) return _limiters

  const redis = getRedis()

  _limiters = {
    'correct-homework': {
      hourly: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '60 m'),
        prefix:  'rl:ch:h',
        analytics: false,
      }),
      daily: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '24 h'),
        prefix:  'rl:ch:d',
        analytics: false,
      }),
    },
    'generate-questions': {
      hourly: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '60 m'),
        prefix:  'rl:gq:h',
        analytics: false,
      }),
      daily: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(50, '24 h'),
        prefix:  'rl:gq:d',
        analytics: false,
      }),
    },
    'check-answers': {
      hourly: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(50, '60 m'),
        prefix:  'rl:ca:h',
        analytics: false,
      }),
      daily: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(150, '24 h'),
        prefix:  'rl:ca:d',
        analytics: false,
      }),
    },
  }

  return _limiters
}

// ─── checkRateLimit hybride ────────────────────────────────────────────────────

/**
 * Vérifie (et atomiquement incrémente) le rate limit.
 *
 * Mode Redis  : check + incrément atomique en une seule opération INCR.
 *               recordUsage() devient un no-op (ne PAS appeler).
 * Mode in-memory : check seulement. Appeler recordUsage() après succès OpenAI.
 *
 * @param identifier  IP ou identifiant extrait par extractIdentifier()
 * @param route       Route concernée
 * @param _tier       Réservé pour le tier premium (non utilisé en v2)
 */
export async function checkRateLimit(
  identifier: string,
  route: RateLimitedRoute,
  _tier: 'free' | 'premium' = 'free'
): Promise<RateLimitResult> {
  // ── Fallback in-memory ─────────────────────────────────────────────────────
  if (!REDIS_CONFIGURED) {
    const { checkRateLimit: checkSync } = await import('./rate-limit')
    return checkSync(identifier, route, _tier)
  }

  // ── Mode Redis ─────────────────────────────────────────────────────────────
  try {
    const limiters = getLimiters()
    const pair = limiters[route]

    const [hourlyRes, dailyRes] = await Promise.all([
      pair.hourly.limit(identifier),
      pair.daily.limit(identifier),
    ])

    // Redis limit() est atomique : check + incrément en une seule opération.
    // Si les deux passes → allowed, les compteurs sont déjà incrémentés.
    // Si l'une échoue → blocked, les compteurs sont quand même incrémentés
    //   pour la fenêtre qui a réussi (comportement correct pour le sliding window).
    const allowed = hourlyRes.success && dailyRes.success

    const limitType: 'hourly' | 'daily' | undefined = !hourlyRes.success
      ? 'hourly'
      : !dailyRes.success
      ? 'daily'
      : undefined

    return {
      allowed,
      identifier,
      remaining: {
        hourly: Math.max(0, hourlyRes.remaining),
        daily:  Math.max(0, dailyRes.remaining),
      },
      resetAt: {
        hourly: hourlyRes.reset,
        daily:  dailyRes.reset,
      },
      limitType,
    }
  } catch (err) {
    // Fail-open : une erreur Redis ne bloque jamais l'application
    console.warn('[rate-limit-redis] Redis error, failing open:', err)
    return {
      allowed: true,
      identifier,
      remaining: { hourly: 999, daily: 999 },
      resetAt:   { hourly: 0, daily: 0 },
    }
  }
}

/**
 * Incrémente les compteurs après une requête réussie.
 *
 * Mode Redis  : NO-OP — limit() a déjà incrémenté de façon atomique.
 * Mode in-memory : délègue à recordUsage() du module in-memory.
 *
 * Maintenu pour la compatibilité des routes existantes.
 * Les routes peuvent continuer d'appeler recordUsage() sans risque.
 */
export async function recordUsage(identifier: string, route: RateLimitedRoute): Promise<void> {
  if (REDIS_CONFIGURED) {
    // No-op en mode Redis : déjà compté par limit()
    return
  }
  const { recordUsage: recordSync } = await import('./rate-limit')
  recordSync(identifier, route)
}
