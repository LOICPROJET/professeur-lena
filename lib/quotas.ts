// lib/quotas.ts
// ─── Freemium quota system — Professeur Léna ─────────────────────────────────
//
// getUserPlan()      — reads JWT from localStorage, returns current plan
// getMonthlyUsage()  — counts API calls this calendar month via openai-costs
// canCorrect()       — can this user make a correction right now?
// canQuiz()          — can this user start a quiz right now?
// getMaxChildren()   — max child profiles for this plan
//
// All functions are client-safe (guard typeof window) and never throw.

import { getUsageRecords } from '@/lib/openai-costs'

// ─────────────────────────────────────────────────────────────────────────────
// Plan types
// ─────────────────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'premium' | 'famille'

export interface PremiumToken {
  plan: Plan
  expiresAt: string        // ISO 8601
  stripeCustomerId: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Free tier limits
// ─────────────────────────────────────────────────────────────────────────────

export const FREE_LIMITS = {
  correctionsPerMonth: 20,
  quizzesPerMonth: 10,
  children: 1,
  historyDays: 30,
} as const

export const PLAN_MAX_CHILDREN: Record<Plan, number> = {
  free:     1,
  premium:  3,
  famille:  5,
}

// localStorage key for the premium JWT
const TOKEN_KEY = 'plena-premium-token'

// ─────────────────────────────────────────────────────────────────────────────
// getUserPlan — reads + validates JWT from localStorage
// Returns 'free' if no token, expired, or invalid.
// ─────────────────────────────────────────────────────────────────────────────

export function getUserPlan(): Plan {
  if (typeof window === 'undefined') return 'free'
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return 'free'
    const token: PremiumToken = JSON.parse(raw)
    // Validate structure
    if (!token.plan || !token.expiresAt) return 'free'
    // Check expiry
    if (new Date(token.expiresAt) <= new Date()) {
      localStorage.removeItem(TOKEN_KEY)
      return 'free'
    }
    if (!(['free', 'premium', 'famille'] as Plan[]).includes(token.plan)) return 'free'
    return token.plan
  } catch {
    return 'free'
  }
}

export function isPremium(): boolean {
  return getUserPlan() !== 'free'
}

export function savePremiumToken(token: PremiumToken): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  } catch {
    // localStorage full — silent
  }
}

export function clearPremiumToken(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // silent
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMonthlyUsage — counts API calls in the current calendar month
// Reuses getUsageRecords() from lib/openai-costs — no new storage key
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthlyUsage {
  corrections: number
  quizzes: number
  /** Calendar month string used for counting (YYYY-MM) */
  month: string
}

export function getMonthlyUsage(): MonthlyUsage {
  if (typeof window === 'undefined') {
    return { corrections: 0, quizzes: 0, month: '' }
  }
  try {
    const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    const records = getUsageRecords()
    const thisMonth = records.filter(r => r.date.slice(0, 7) === currentMonth)

    return {
      corrections: thisMonth.filter(r => r.route === 'correct-homework').length,
      quizzes:     thisMonth.filter(r => r.route === 'generate-questions').length,
      month:       currentMonth,
    }
  } catch {
    return { corrections: 0, quizzes: 0, month: '' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quota checks — return structured result for UI decision
// ─────────────────────────────────────────────────────────────────────────────

export interface QuotaCheckResult {
  allowed: boolean
  used: number
  limit: number
  /** Remaining after this check (post-increment) */
  remaining: number
  /** 'soft' → show banner | 'hard' → show paywall | null → no warning */
  warningLevel: 'soft' | 'hard' | null
}

export function canCorrect(): QuotaCheckResult {
  const plan = getUserPlan()
  if (plan !== 'free') {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity, warningLevel: null }
  }

  const { corrections } = getMonthlyUsage()
  const limit = FREE_LIMITS.correctionsPerMonth
  const remaining = limit - corrections

  if (remaining <= 0) {
    return { allowed: false, used: corrections, limit, remaining: 0, warningLevel: 'hard' }
  }

  // Soft warning thresholds: ≤5 remaining
  const warningLevel: 'soft' | null = remaining <= 5 ? 'soft' : null

  return {
    allowed: true,
    used: corrections,
    limit,
    remaining,
    warningLevel,
  }
}

export function canQuiz(): QuotaCheckResult {
  const plan = getUserPlan()
  if (plan !== 'free') {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity, warningLevel: null }
  }

  const { quizzes } = getMonthlyUsage()
  const limit = FREE_LIMITS.quizzesPerMonth
  const remaining = limit - quizzes

  if (remaining <= 0) {
    return { allowed: false, used: quizzes, limit, remaining: 0, warningLevel: 'hard' }
  }

  const warningLevel: 'soft' | null = remaining <= 3 ? 'soft' : null

  return {
    allowed: true,
    used: quizzes,
    limit,
    remaining,
    warningLevel,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMaxChildren — max children profiles for the current plan
// ─────────────────────────────────────────────────────────────────────────────

export function getMaxChildren(): number {
  return PLAN_MAX_CHILDREN[getUserPlan()]
}

// ─────────────────────────────────────────────────────────────────────────────
// History gate — days of history accessible for current plan
// ─────────────────────────────────────────────────────────────────────────────

export function getHistoryDaysLimit(): number | null {
  // null = unlimited
  return getUserPlan() === 'free' ? FREE_LIMITS.historyDays : null
}
