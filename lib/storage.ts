import { HomeworkRecord, Badge, ChildProfile, MAX_CHILDREN, WeeklyReport, ReportExport } from './types'

const STORAGE_KEY = 'professeur-lena-history'      // legacy key (no child)
const CHILDREN_KEY = 'professeur-lena-children'
const ACTIVE_CHILD_KEY = 'professeur-lena-active-child'
const MIGRATION_KEY = 'professeur-lena-migrated-v1'
const MAX_RECORDS = 100
const MAX_REPORTS = 12

function homeworkKey(childId: string | null | undefined): string {
  return childId ? `professeur-lena-history-${childId}` : STORAGE_KEY
}

function reportsKey(childId: string): string {
  return `professeur-lena-reports-${childId}`
}

// ─── Children CRUD ────────────────────────────────────────────────────────────

export function getChildren(): ChildProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CHILDREN_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

export function saveChild(profile: ChildProfile): void {
  if (typeof window === 'undefined') return
  const existing = getChildren()
  const updated = [profile, ...existing.filter(c => c.id !== profile.id)]
  try { localStorage.setItem(CHILDREN_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
}

export function deleteChild(id: string): void {
  if (typeof window === 'undefined') return
  const children = getChildren()

  // Guard: never allow deleting the last child profile.
  // This is also enforced in the UI (handleDeleteRequest + DeleteModal),
  // but we re-check here as a final safety net against any direct call.
  if (children.length <= 1) {
    console.warn('[Léna] Cannot delete the last child profile.')
    return
  }

  const updated = children.filter(c => c.id !== id)
  try { localStorage.setItem(CHILDREN_KEY, JSON.stringify(updated)) } catch { /* ignore */ }

  // ⚠️ PERMANENT: removes ALL homework records for this child from localStorage.
  // There is no undo, no recycle bin, no recovery mechanism.
  // The UI must show a DeleteModal confirmation before calling this function.
  try { localStorage.removeItem(homeworkKey(id)) } catch { /* ignore */ }

  // If the deleted child was active, automatically switch to the first remaining child
  if (getActiveChildId() === id) {
    setActiveChildId(updated[0]?.id ?? null)
  }
}

// ─── Premium limits ───────────────────────────────────────────────────────────

export function canAddChild(): boolean {
  if (typeof window === 'undefined') return false
  return getChildren().length < MAX_CHILDREN
}

// ─── Migration: legacy data → first child profile ─────────────────────────────
// Runs once on app boot. Copies professeur-lena-history records to
// professeur-lena-history-{childId} without deleting the original key.

export function runMigration(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(MIGRATION_KEY)) return

    const legacyRaw = localStorage.getItem(STORAGE_KEY)
    if (!legacyRaw) {
      localStorage.setItem(MIGRATION_KEY, '1')
      return
    }

    let legacyRecords: HomeworkRecord[]
    try { legacyRecords = JSON.parse(legacyRaw) }
    catch { legacyRecords = [] }

    if (!legacyRecords.length) {
      localStorage.setItem(MIGRATION_KEY, '1')
      return
    }

    // Ensure at least one child profile exists
    const children = getChildren()
    let targetChild: ChildProfile

    if (children.length === 0) {
      targetChild = {
        id: `child_migration_${Date.now()}`,
        name: 'Mon enfant',
        emoji: '👧',
        createdAt: new Date().toISOString(),
      }
      saveChild(targetChild)
      setActiveChildId(targetChild.id)
    } else {
      targetChild = children[0]
      if (!getActiveChildId()) setActiveChildId(targetChild.id)
    }

    // Merge records into child's storage key (no duplicates by id)
    const existingForChild = getAllHomework(targetChild.id)
    const existingIds = new Set(existingForChild.map(r => r.id))
    const toMigrate = legacyRecords
      .filter(r => !existingIds.has(r.id))
      .map(r => ({ ...r, childId: targetChild.id }))

    if (toMigrate.length > 0) {
      const merged = [...existingForChild, ...toMigrate].slice(0, MAX_RECORDS)
      let writeSucceeded = false
      try {
        localStorage.setItem(homeworkKey(targetChild.id), JSON.stringify(merged))
        writeSucceeded = true
      } catch {
        // Quota exceeded — do NOT set the migration flag so the next boot retries
        console.warn('[Léna] Migration: quota exceeded. Will retry on next boot.')
      }
      if (!writeSucceeded) return  // Leave flag unset → will retry next time
    }

    // Only reached if nothing to migrate OR write succeeded — safe to mark as done
    localStorage.setItem(MIGRATION_KEY, '1')
  } catch (e) {
    console.warn('[Léna] Migration failed:', e)
  }
}

export function getActiveChildId(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(ACTIVE_CHILD_KEY) } catch { return null }
}

export function setActiveChildId(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (id) localStorage.setItem(ACTIVE_CHILD_KEY, id)
    else localStorage.removeItem(ACTIVE_CHILD_KEY)
  } catch { /* ignore */ }
}

export function getActiveChild(): ChildProfile | null {
  const id = getActiveChildId()
  if (!id) return null
  return getChildren().find(c => c.id === id) ?? null
}

/**
 * Always returns a valid ChildProfile — never null.
 * Priority: (1) stored active child → (2) first existing child → (3) create "Mon enfant".
 * Use this everywhere a childId is required to prevent orphan records.
 */
export function getOrCreateActiveChild(): ChildProfile {
  if (typeof window === 'undefined') {
    // SSR safety — client-only code should never reach this branch
    return { id: 'ssr_fallback', name: 'Mon enfant', emoji: '👧', createdAt: new Date().toISOString() }
  }

  const activeId = getActiveChildId()
  const children = getChildren()

  // 1. Stored active child exists and is valid
  if (activeId) {
    const found = children.find(c => c.id === activeId)
    if (found) return found
  }

  // 2. At least one child exists — use the first, update the active pointer
  if (children.length > 0) {
    const first = children[0]
    setActiveChildId(first.id)
    return first
  }

  // 3. No profile at all — create a default one so data is never orphaned
  const newChild: ChildProfile = {
    id: `child_default_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: 'Mon enfant',
    emoji: '👧',
    createdAt: new Date().toISOString(),
  }
  saveChild(newChild)
  setActiveChildId(newChild.id)
  return newChild
}

// ─── Generate a simple unique ID ─────────────────────────────────────────────

export function generateId(): string {
  return `hw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ─── Resize image to thumbnail before storing ────────────────────────────────
// Keeps storage lean (≈30-50KB instead of 2-5MB per photo)

export async function resizeImageForStorage(dataUrl: string): Promise<string> {
  if (typeof window === 'undefined') return ''

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 480
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(''); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => resolve('')
    img.src = dataUrl
  })
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getAllHomework(childId?: string | null): HomeworkRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(homeworkKey(childId))
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function getHomeworkById(id: string, childId?: string | null): HomeworkRecord | null {
  return getAllHomework(childId).find((r) => r.id === id) ?? null
}

// ─── Write ────────────────────────────────────────────────────────────────────

export interface SaveResult {
  /** true when images had to be stripped because the quota was reached */
  quotaWarning: boolean
}

export function saveHomework(record: HomeworkRecord, childId?: string | null): SaveResult {
  if (typeof window === 'undefined') return { quotaWarning: false }
  const key = homeworkKey(childId)

  const tryWrite = (records: HomeworkRecord[]) => {
    localStorage.setItem(key, JSON.stringify(records))
  }

  const existing = getAllHomework(childId)
  const updated = [{ ...record, childId: childId ?? undefined }, ...existing.filter((r) => r.id !== record.id)].slice(0, MAX_RECORDS)

  try {
    tryWrite(updated)
    return { quotaWarning: false }
  } catch {
    // First fallback: strip all thumbnails to free space, keep correction data
    try {
      const stripped = updated.map((r) => ({ ...r, imageDataUrl: '' }))
      tryWrite(stripped)
      return { quotaWarning: true }  // Saved but images stripped
    } catch {
      console.warn('[Léna] Could not save to localStorage (quota exceeded)')
      return { quotaWarning: true }  // Could not save at all
    }
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteHomework(id: string, childId?: string | null): void {
  if (typeof window === 'undefined') return
  const key = homeworkKey(childId)
  const updated = getAllHomework(childId).filter((r) => r.id !== id)
  try {
    localStorage.setItem(key, JSON.stringify(updated))
  } catch {
    /* ignore */
  }
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface SubjectStats {
  subject: string
  count: number
  average: number
  scores: number[]
}

export interface GlobalStats {
  total: number
  globalAverage: number
  bySubject: SubjectStats[]
  topMasteredSkills: string[]
  topWeakSkills: string[]
  topCommonMistakes: string[]
  recentAdvice: string[]
}

function countFrequency(items: string[]): Array<{ text: string; count: number }> {
  const freq: Record<string, number> = {}
  for (const item of items) {
    const key = item.trim().toLowerCase()
    if (key) freq[key] = (freq[key] || 0) + 1
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([text, count]) => ({ text, count }))
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export function computeBadges(records: HomeworkRecord[]): Badge[] {
  const total = records.length
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const scores = sorted.map(r => r.correction.score)

  // Streak
  const days = Array.from(new Set(records.map(r => r.date.slice(0, 10))))
  const sortedDays = days.sort().reverse()
  let streak = 0
  const today = new Date()
  for (let i = 0; i < sortedDays.length; i++) {
    const expected = new Date(today)
    expected.setDate(today.getDate() - i)
    if (sortedDays[i] === expected.toISOString().slice(0, 10)) streak++
    else break
  }

  // Per subject averages
  const bySubject: Record<string, number[]> = {}
  for (const r of records) {
    if (!bySubject[r.subject]) bySubject[r.subject] = []
    bySubject[r.subject].push(r.correction.score)
  }
  const subjectAvg = (s: string) => {
    const arr = bySubject[s] ?? []
    return arr.length >= 3 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  }

  // Global average
  const globalAvg = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0

  // Progress
  const improved = scores.length >= 2 && scores[scores.length - 1] - scores[0] >= 3

  const allBadges: Badge[] = [
    {
      id: 'first',
      emoji: '🌱',
      label: 'Premier pas',
      description: 'Corriger son 1er devoir',
      unlocked: total >= 1,
    },
    {
      id: 'streak3',
      emoji: '🔥',
      label: 'En feu',
      description: '3 jours de suite',
      unlocked: streak >= 3,
    },
    {
      id: 'streak7',
      emoji: '💪',
      label: 'Persévérant',
      description: '7 jours de suite',
      unlocked: streak >= 7,
    },
    {
      id: 'score18',
      emoji: '⭐',
      label: 'Bonne note',
      description: 'Obtenir ≥ 18/20',
      unlocked: scores.some(s => s >= 18),
    },
    {
      id: 'avg15',
      emoji: '🏆',
      label: 'Excellent',
      description: 'Moyenne ≥ 15/20 (5+ exercices)',
      unlocked: total >= 5 && globalAvg >= 15,
    },
    {
      id: 'count10',
      emoji: '📚',
      label: 'Assidu',
      description: '10 exercices corrigés',
      unlocked: total >= 10,
    },
    {
      id: 'count25',
      emoji: '🚀',
      label: 'Expert',
      description: '25 exercices corrigés',
      unlocked: total >= 25,
    },
    {
      id: 'maths',
      emoji: '🔢',
      label: 'As des Maths',
      description: 'Moyenne Maths ≥ 15 (3+ exercices)',
      unlocked: subjectAvg('Maths') >= 15,
    },
    {
      id: 'francais',
      emoji: '📖',
      label: 'As du Français',
      description: 'Moyenne Français ≥ 15 (3+ exercices)',
      unlocked: subjectAvg('Français') >= 15,
    },
    {
      id: 'progress',
      emoji: '📈',
      label: 'En progrès',
      description: '+3 pts entre le 1er et dernier devoir',
      unlocked: improved,
    },
  ]

  // Unlocked first, then locked
  return [
    ...allBadges.filter(b => b.unlocked),
    ...allBadges.filter(b => !b.unlocked),
  ]
}

export function computeStats(records: HomeworkRecord[]): GlobalStats {
  if (records.length === 0) {
    return {
      total: 0,
      globalAverage: 0,
      bySubject: [],
      topMasteredSkills: [],
      topWeakSkills: [],
      topCommonMistakes: [],
      recentAdvice: [],
    }
  }

  // Global average
  const scores = records.map((r) => r.correction.score)
  const globalAverage = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10

  // By subject
  const subjectMap: Record<string, number[]> = {}
  for (const r of records) {
    if (!subjectMap[r.subject]) subjectMap[r.subject] = []
    subjectMap[r.subject].push(r.correction.score)
  }
  const bySubject: SubjectStats[] = Object.entries(subjectMap)
    .map(([subject, s]) => ({
      subject,
      count: s.length,
      scores: s,
      average: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count)

  // Frequency analysis
  const allMastered = records.flatMap((r) => r.correction.masteredSkills ?? [])
  const allWeak = records.flatMap((r) => r.correction.weakSkills ?? [])
  const allMistakes = records.flatMap((r) => r.correction.commonMistakes ?? [])

  const topMasteredSkills = countFrequency(allMastered).slice(0, 5).map((x) => x.text)
  const topWeakSkills = countFrequency(allWeak).slice(0, 5).map((x) => x.text)
  const topCommonMistakes = countFrequency(allMistakes).slice(0, 5).map((x) => x.text)

  // Recent parent advice (last 3 unique)
  const recentAdvice = records
    .slice(0, 10)
    .map((r) => r.correction.parentAdvice)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3)

  return {
    total: records.length,
    globalAverage,
    bySubject,
    topMasteredSkills,
    topWeakSkills,
    topCommonMistakes,
    recentAdvice,
  }
}

// ─── Progress stats (temporal analysis) ──────────────────────────────────────

export interface ProgressStats {
  last7DaysCount: number
  last30DaysCount: number
  last7DaysAverage: number       // 0 when no records in window
  last30DaysAverage: number      // 0 when no records in window
  previous7DaysAverage: number   // average of the 7 days BEFORE the last 7
  averageTrend: number           // last7Avg − prev7Avg; 0 if insufficient data
  mostWorkedSubject: string | null
  bestSubject: string | null     // highest avg across all records, min 2 entries
}

function avgOfRecords(items: HomeworkRecord[]): number {
  if (!items.length) return 0
  return Math.round((items.reduce((s, r) => s + r.correction.score, 0) / items.length) * 10) / 10
}

export function computeProgressStats(records: HomeworkRecord[]): ProgressStats {
  if (!records.length) {
    return {
      last7DaysCount: 0, last30DaysCount: 0,
      last7DaysAverage: 0, last30DaysAverage: 0,
      previous7DaysAverage: 0, averageTrend: 0,
      mostWorkedSubject: null, bestSubject: null,
    }
  }

  const now = Date.now()
  const DAY = 86_400_000

  const last7  = records.filter(r => now - new Date(r.date).getTime() < 7 * DAY)
  const last30 = records.filter(r => now - new Date(r.date).getTime() < 30 * DAY)
  const prev7  = records.filter(r => {
    const age = now - new Date(r.date).getTime()
    return age >= 7 * DAY && age < 14 * DAY
  })

  const last7Avg = avgOfRecords(last7)
  const prev7Avg = avgOfRecords(prev7)

  // Subject analysis across ALL records
  const subjectCount: Record<string, number> = {}
  const subjectScores: Record<string, number[]> = {}
  for (const r of records) {
    subjectCount[r.subject] = (subjectCount[r.subject] || 0) + 1
    if (!subjectScores[r.subject]) subjectScores[r.subject] = []
    subjectScores[r.subject].push(r.correction.score)
  }

  const mostWorkedSubject = Object.entries(subjectCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // bestSubject requires ≥ 2 records to be meaningful
  const bestSubject = Object.entries(subjectScores)
    .filter(([, scores]) => scores.length >= 2)
    .map(([subject, scores]) => ({
      subject,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => b.avg - a.avg)[0]?.subject ?? null

  return {
    last7DaysCount: last7.length,
    last30DaysCount: last30.length,
    last7DaysAverage: last7Avg,
    last30DaysAverage: avgOfRecords(last30),
    previous7DaysAverage: prev7Avg,
    averageTrend: last7.length > 0 && prev7.length > 0
      ? Math.round((last7Avg - prev7Avg) * 10) / 10
      : 0,
    mostWorkedSubject,
    bestSubject,
  }
}

// ─── Weekly reports ───────────────────────────────────────────────────────────

export function getWeeklyReports(childId: string): WeeklyReport[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(reportsKey(childId))
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

export function saveWeeklyReport(report: WeeklyReport): void {
  if (typeof window === 'undefined') return
  const existing = getWeeklyReports(report.childId)
  // Deduplicate by id, most recent first, cap at MAX_REPORTS
  const updated = [report, ...existing.filter(r => r.id !== report.id)].slice(0, MAX_REPORTS)
  try {
    localStorage.setItem(reportsKey(report.childId), JSON.stringify(updated))
  } catch {
    console.warn('[Léna] Could not save weekly report (quota exceeded)')
  }
}

/**
 * Generates a WeeklyReport from the last 7 days of homework for a given child.
 * Does NOT save automatically — call saveWeeklyReport() afterwards.
 */
export function generateWeeklyReport(childId: string): WeeklyReport {
  const records = getAllHomework(childId)
  const now = Date.now()
  const DAY = 86_400_000

  const last7 = records.filter(r => now - new Date(r.date).getTime() < 7 * DAY)
  const prev7 = records.filter(r => {
    const age = now - new Date(r.date).getTime()
    return age >= 7 * DAY && age < 14 * DAY
  })

  const totalCorrections = last7.length
  const averageScore = avgOfRecords(last7)
  const prev7Avg = avgOfRecords(prev7)
  const scoreTrend = last7.length > 0 && prev7.length > 0
    ? Math.round((averageScore - prev7Avg) * 10) / 10
    : 0

  // Subject analysis on this week's records
  const subjectCount: Record<string, number> = {}
  const subjectScores: Record<string, number[]> = {}
  for (const r of last7) {
    subjectCount[r.subject] = (subjectCount[r.subject] || 0) + 1
    if (!subjectScores[r.subject]) subjectScores[r.subject] = []
    subjectScores[r.subject].push(r.correction.score)
  }

  const mostWorkedSubject = Object.entries(subjectCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const bestSubject = Object.entries(subjectScores)
    .map(([subject, scores]) => ({ subject, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.subject ?? null

  // Skills frequency for this week
  const allMastered = last7.flatMap(r => r.correction.masteredSkills ?? [])
  const allWeak = last7.flatMap(r => r.correction.weakSkills ?? [])
  const strengths = countFrequency(allMastered).slice(0, 3).map(x => x.text)
  const weaknesses = countFrequency(allWeak).slice(0, 3).map(x => x.text)

  // Natural language messages
  let parentSummary: string
  let recommendation: string

  if (totalCorrections === 0) {
    parentSummary = "Aucun exercice corrigé cette semaine."
    recommendation = "Cette semaine a été calme. Quelques exercices réguliers permettront de reprendre le rythme."
  } else if (totalCorrections === 1) {
    parentSummary = `1 exercice corrigé cette semaine${averageScore > 0 ? `, avec une note de ${averageScore}/20` : ''}.`
    recommendation = "Un bon début ! L'idéal serait de viser 2 à 3 exercices par semaine pour progresser régulièrement."
  } else {
    const subjectStr = mostWorkedSubject ? ` en ${mostWorkedSubject}` : ''
    parentSummary = `${totalCorrections} exercices corrigés cette semaine${subjectStr}, avec une moyenne de ${averageScore}/20.`

    if (scoreTrend > 1) {
      recommendation = `Belle progression cette semaine (+${scoreTrend} pts vs la semaine précédente). Les efforts paient, continuez ainsi !`
    } else if (scoreTrend < -1) {
      const tip = weaknesses.length > 0 ? ` sur "${weaknesses[0]}"` : ''
      recommendation = `Une légère baisse est observée (${scoreTrend} pts). Quelques révisions ciblées${tip} devraient rapidement aider.`
    } else if (averageScore >= 16) {
      recommendation = `Excellente semaine ! La moyenne de ${averageScore}/20 est remarquable. Encouragez à maintenir ce rythme.`
    } else if (averageScore >= 13) {
      recommendation = `Bonne semaine dans l'ensemble (${averageScore}/20). Continuez à encourager et à maintenir la régularité.`
    } else if (averageScore >= 10) {
      recommendation = `Semaine correcte (${averageScore}/20). Insistez sur les points à retravailler pour progresser davantage.`
    } else {
      recommendation = `La semaine montre quelques difficultés (moy. ${averageScore}/20). Un accompagnement ciblé serait bénéfique cette semaine.`
    }
  }

  return {
    id: `report_${childId}_${Date.now()}`,
    childId,
    generatedAt: new Date().toISOString(),
    weekStart: new Date(now - 6 * DAY).toISOString(),
    weekEnd: new Date(now).toISOString(),
    totalCorrections,
    averageScore,
    scoreTrend,
    strengths,
    weaknesses,
    mostWorkedSubject,
    bestSubject,
    parentSummary,
    recommendation,
  }
}

/**
 * Returns a clean, serialisable structure from a WeeklyReport.
 * Designed for reuse when PDF export or email sending is implemented.
 */
export function buildReportData(report: WeeklyReport): ReportExport {
  const child = getChildren().find(c => c.id === report.childId)
  return {
    meta: {
      reportId: report.id,
      generatedAt: report.generatedAt,
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      childName: child?.name ?? 'Enfant',
      childEmoji: child?.emoji ?? '👧',
    },
    stats: {
      totalCorrections: report.totalCorrections,
      averageScore: report.averageScore,
      scoreTrend: report.scoreTrend,
      mostWorkedSubject: report.mostWorkedSubject,
      bestSubject: report.bestSubject,
    },
    insights: {
      strengths: report.strengths,
      weaknesses: report.weaknesses,
      parentSummary: report.parentSummary,
      recommendation: report.recommendation,
    },
  }
}
