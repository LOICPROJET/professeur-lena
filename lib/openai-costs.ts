// lib/openai-costs.ts
// ─── Centralised OpenAI cost tracking ────────────────────────────────────────
//
// estimateCost()  — pure function, runs server-side (API routes) AND client-side
// saveUsage()     — client-only (localStorage), best-effort, never throws
// getUsageRecords() / getCostStats() — client-only
//
// To add a new model: extend COST_RATES below — nothing else needs changing.

// ── Pricing table ($ per 1M tokens) — verified June 2026 ─────────────────────
const COST_RATES: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o':           { inputPer1M: 2.50,  outputPer1M: 10.00 },
  'gpt-4o-mini':      { inputPer1M: 0.15,  outputPer1M: 0.60  },
  'gpt-4.1':          { inputPer1M: 2.00,  outputPer1M: 8.00  },
  'gpt-4.1-mini':     { inputPer1M: 0.40,  outputPer1M: 1.60  },
  'gpt-4.1-nano':     { inputPer1M: 0.10,  outputPer1M: 0.40  },
  'gpt-4o-2024-05-13':{ inputPer1M: 5.00,  outputPer1M: 15.00 },
}

export type APIRoute = 'correct-homework' | 'generate-questions' | 'check-answers'

// ── UsageMeta — attached to each API response ─────────────────────────────────
// The API route builds this from response.usage and sends it with the result.
export interface UsageMeta {
  route: APIRoute
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
}

// ── UsageRecord — what gets persisted in localStorage ─────────────────────────
export interface UsageRecord extends UsageMeta {
  id: string   // lightweight uid
  date: string // ISO 8601
}

const STORAGE_KEY = 'plena-usage-log'
const MAX_DAYS = 90

// ─────────────────────────────────────────────────────────────────────────────
// estimateCost — server-safe pure function
// Called by API routes to compute cost before returning the response.
// Falls back to gpt-4o rates if model is unknown.
// ─────────────────────────────────────────────────────────────────────────────
export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rates = COST_RATES[model] ?? COST_RATES['gpt-4o']
  return (promptTokens * rates.inputPer1M + completionTokens * rates.outputPer1M) / 1_000_000
}

// ─────────────────────────────────────────────────────────────────────────────
// saveUsage — client-only, best-effort (never propagates errors to caller)
// Called by page components after receiving _usage from an API response.
// ─────────────────────────────────────────────────────────────────────────────
export function saveUsage(meta: UsageMeta): void {
  if (typeof window === 'undefined') return
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - MAX_DAYS)

    const raw = localStorage.getItem(STORAGE_KEY)
    const records: UsageRecord[] = raw ? (JSON.parse(raw) as UsageRecord[]) : []

    // Purge records older than MAX_DAYS
    const fresh = records.filter(r => new Date(r.date) >= cutoff)

    fresh.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString(),
      ...meta,
    })

    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  } catch {
    // localStorage full or unavailable — silent, never breaks the UX
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getUsageRecords — client-only
// ─────────────────────────────────────────────────────────────────────────────
export function getUsageRecords(days?: number): UsageRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const records = JSON.parse(raw) as UsageRecord[]
    if (days === undefined) return records
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return records.filter(r => new Date(r.date) >= cutoff)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getCostStats — client-only, computes all aggregates for the admin dashboard
// ─────────────────────────────────────────────────────────────────────────────

export interface PeriodStats {
  costUsd: number
  calls: number
  corrections: number
  quizGen: number
  quizCheck: number
}

export interface CostStats {
  today: PeriodStats
  d7:    PeriodStats
  d30:   PeriodStats
  d90:   PeriodStats
  // Per-action averages (all time)
  avgCostPerCorrection: number    // $ per correct-homework call
  avgCostPerQuizSession: number   // $ per generate-questions call (proxy for a quiz session)
  // Route breakdown for last 30 days
  byRoute: Record<APIRoute, { calls: number; costUsd: number }>
  // Top route by call volume (all time)
  topRoute: APIRoute | '—'
  // Totals (all time, up to 90 days)
  totalCalls: number
  totalCostUsd: number
  // Daily cost sparkline — last 14 days
  dailyCosts: { date: string; costUsd: number }[]
}

export function getCostStats(): CostStats {
  const all = getUsageRecords(90)

  const todayStr = new Date().toISOString().slice(0, 10)

  const daysCutoff = (n: number): Date => {
    const d = new Date(); d.setDate(d.getDate() - n); return d
  }

  const agg = (records: UsageRecord[]): PeriodStats => ({
    costUsd:     records.reduce((s, r) => s + r.estimatedCostUsd, 0),
    calls:       records.length,
    corrections: records.filter(r => r.route === 'correct-homework').length,
    quizGen:     records.filter(r => r.route === 'generate-questions').length,
    quizCheck:   records.filter(r => r.route === 'check-answers').length,
  })

  const todayRecs = all.filter(r => r.date.slice(0, 10) === todayStr)
  const d7Recs    = all.filter(r => new Date(r.date) >= daysCutoff(7))
  const d30Recs   = all.filter(r => new Date(r.date) >= daysCutoff(30))

  // Per-action averages
  const corrections = all.filter(r => r.route === 'correct-homework')
  const quizGens    = all.filter(r => r.route === 'generate-questions')
  const avgCostPerCorrection  = corrections.length
    ? corrections.reduce((s, r) => s + r.estimatedCostUsd, 0) / corrections.length : 0
  const avgCostPerQuizSession = quizGens.length
    ? quizGens.reduce((s, r) => s + r.estimatedCostUsd, 0) / quizGens.length : 0

  // Route breakdown (d30)
  const routes: APIRoute[] = ['correct-homework', 'generate-questions', 'check-answers']
  const byRoute = Object.fromEntries(
    routes.map(route => [
      route,
      {
        calls:   d30Recs.filter(r => r.route === route).length,
        costUsd: d30Recs.filter(r => r.route === route).reduce((s, r) => s + r.estimatedCostUsd, 0),
      },
    ])
  ) as Record<APIRoute, { calls: number; costUsd: number }>

  // Top route (all time)
  const ranked = routes
    .map(route => ({ route, count: all.filter(r => r.route === route).length }))
    .sort((a, b) => b.count - a.count)
  const topRoute: APIRoute | '—' = ranked[0]?.count > 0 ? ranked[0].route : '—'

  // Daily sparkline — last 14 days
  const dailyCosts: { date: string; costUsd: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    dailyCosts.push({
      date: ds,
      costUsd: all
        .filter(r => r.date.slice(0, 10) === ds)
        .reduce((s, r) => s + r.estimatedCostUsd, 0),
    })
  }

  return {
    today: agg(todayRecs),
    d7:    agg(d7Recs),
    d30:   agg(d30Recs),
    d90:   agg(all),
    avgCostPerCorrection,
    avgCostPerQuizSession,
    byRoute,
    topRoute,
    totalCalls:   all.length,
    totalCostUsd: all.reduce((s, r) => s + r.estimatedCostUsd, 0),
    dailyCosts,
  }
}
