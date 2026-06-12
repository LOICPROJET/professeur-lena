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

// ─── Level-adapted report personas ───────────────────────────────────────────

const PRIMARY_LEVELS_REPORT = ['CP', 'CE1', 'CE2', 'CM1', 'CM2']

interface LevelPersona {
  noActivity: string
  single: (score: number, subject: string | null) => string
  summaryTone: (score: number) => string
  trendUp: (pts: number) => string
  trendDown: (pts: number, weak?: string) => string
  flat: (score: number, weak?: string) => string
  tip: string
}

const REPORT_PERSONA: Record<string, LevelPersona> = {
  CP: {
    noActivity: `Pas d'activité cette semaine — sans inquiétude. Quelques minutes de lecture ou de jeu de sons chaque soir suffisent pour maintenir le rythme à cet âge.`,
    single: (score, sub) =>
      `1 petite activité${sub ? ` en ${sub}` : ''} cette semaine${score > 0 ? ` (${score}/20)` : ''} — bon début ! Des sessions courtes de 10 min, 2 à 3 fois par semaine, ancrent les apprentissages.`,
    summaryTone: (s) =>
      s >= 15 ? `Belle semaine — votre enfant est dans une super dynamique !`
      : s >= 10 ? `Semaine encourageante, les apprentissages de CP avancent bien.`
      : `Quelques tâtonnements, tout à fait normaux à 6 ans.`,
    trendUp: (pts) => `Votre enfant progresse (+${pts} pts) — c'est formidable, félicitez-le chaleureusement !`,
    trendDown: (pts, weak) => `Petite baisse (${pts} pts)${weak ? ` — un peu de pratique sur "${weak}"` : ''} — tout à fait normal en CP, ne dramatisez pas.`,
    flat: (score, weak) =>
      score >= 15 ? `Ces bons résultats montrent que les bases se mettent en place.`
      : score < 10 ? `Quelques difficultés, mais chaque erreur est une étape normale d'apprentissage à 6 ans.${weak ? ` Pratiquez "${weak}" en jouant.` : ''}`
      : `Continuez à encourager, la régularité est la clé à cet âge.`,
    tip: `En CP, 10 à 15 minutes de lecture à voix haute chaque soir sont bien plus efficaces qu'une longue séance. La régularité et la bonne humeur font la différence.`,
  },
  CE1: {
    noActivity: `Aucun exercice cette semaine. Une courte activité de lecture ou de calcul mental (15 min) permettra de relancer la régularité rapidement.`,
    single: (score, sub) =>
      `1 exercice${sub ? ` en ${sub}` : ''} cette semaine${score > 0 ? ` (${score}/20)` : ''}. Viser 2 à 3 activités de 15 minutes serait idéal pour progresser régulièrement.`,
    summaryTone: (s) =>
      s >= 15 ? `Très belle semaine !`
      : s >= 10 ? `La semaine va dans la bonne direction.`
      : `Quelques points à revoir, mais rien d'insurmontable.`,
    trendUp: (pts) => `Belle progression (+${pts} pts) — les efforts réguliers payent.`,
    trendDown: (pts, weak) => `Légère baisse (${pts} pts)${weak ? ` — quelques révisions sur "${weak}"` : ' — quelques révisions'} remettront vite les choses en place.`,
    flat: (score, weak) =>
      score >= 15 ? `Ces bons résultats confirment que les bases de CE1 sont bien assimilées.`
      : score < 10 ? `Ces difficultés sont surmontables avec un peu de pratique régulière.${weak ? ` Travaillez "${weak}" en priorité.` : ''}`
      : `La régularité est la clé — quelques minutes chaque jour suffisent à progresser.`,
    tip: `En CE1, valorisez chaque petit progrès. 15 minutes de lecture ou de dictée le soir, en routine, consolident les bases de façon très efficace.`,
  },
  CE2: {
    noActivity: `Pas d'exercice cette semaine. Relancer avec 20 minutes sur une leçon récente est idéal pour ne pas perdre le fil des acquis de CE2.`,
    single: (score, sub) =>
      `1 exercice${sub ? ` en ${sub}` : ''} cette semaine${score > 0 ? ` (${score}/20)` : ''}. 3 exercices hebdomadaires permettraient de consolider davantage les acquis du programme.`,
    summaryTone: (s) =>
      s >= 15 ? `Excellente semaine — l'autonomie se confirme.`
      : s >= 10 ? `Bonne semaine, les méthodes commencent à s'installer.`
      : `Semaine mitigée — quelques notions sont à consolider.`,
    trendUp: (pts) => `Progression nette (+${pts} pts) — les méthodes apprises commencent à s'ancrer.`,
    trendDown: (pts, weak) => `Légère baisse (${pts} pts)${weak ? ` — réviser "${weak}" avec un exercice ciblé` : ' — un peu de révision ciblée'} suffira à corriger ça.`,
    flat: (score, weak) =>
      score >= 15 ? `L'autonomie se confirme — ces résultats témoignent d'une belle maîtrise.`
      : score < 10 ? `Identifier les notions précises à retravailler permettra de progresser rapidement.${weak ? ` Commencez par "${weak}".` : ''}`
      : `Encouragez votre enfant à relire les leçons avant de faire les exercices.`,
    tip: `En CE2, encouragez votre enfant à relire ses leçons avant de commencer les exercices. Cette habitude simple améliore notablement les résultats.`,
  },
  CM1: {
    noActivity: `Semaine sans exercice. En CM1, maintenir la régularité est important pour préparer sereinement le passage en CM2.`,
    single: (score, sub) =>
      `1 exercice${sub ? ` en ${sub}` : ''} cette semaine${score > 0 ? ` (${score}/20)` : ''}. L'idéal serait 3 à 4 exercices hebdomadaires pour progresser de façon solide.`,
    summaryTone: (s) =>
      s >= 15 ? `Excellente semaine — les bases sont solides.`
      : s >= 10 ? `Bonne semaine dans l'ensemble.`
      : `Semaine difficile — un suivi ciblé est recommandé.`,
    trendUp: (pts) => `Belle progression (+${pts} pts) — la régularité et la méthode paient.`,
    trendDown: (pts, weak) => `Baisse de ${pts} pts${weak ? ` — des révisions ciblées sur "${weak}"` : ' — des révisions ciblées'} permettront de corriger ça avant le CM2.`,
    flat: (score, weak) =>
      score >= 15 ? `Les bases sont solides — les fondamentaux sont bien installés pour le CM2.`
      : score < 10 ? `Un suivi ciblé des notions difficiles évitera un décalage en CM2.${weak ? ` Priorisez "${weak}".` : ''}`
      : `La constance est la vraie clé en CM1 — 30 minutes régulières valent mieux que des sessions sporadiques.`,
    tip: `En CM1, 30 minutes de travail régulier (exercices + relecture de leçon) suffisent pour préparer sereinement le passage en CM2. La constance est la vraie clé.`,
  },
  CM2: {
    noActivity: `Aucun exercice cette semaine. En CM2, la régularité du travail est directement liée à la qualité de la transition vers le collège.`,
    single: (score, sub) =>
      `1 exercice${sub ? ` en ${sub}` : ''} cette semaine${score > 0 ? ` (${score}/20)` : ''}. En CM2, 4 à 5 exercices par semaine permettent une vraie préparation au collège.`,
    summaryTone: (s) =>
      s >= 15 ? `Semaine remarquable — le niveau est au rendez-vous pour l'entrée en 6ème.`
      : s >= 10 ? `Semaine solide. Les acquis progressent dans le bon sens.`
      : `Semaine difficile. Des lacunes non traitées maintenant risquent de créer un écart en 6ème.`,
    trendUp: (pts) => `Progression significative (+${pts} pts) — la rigueur et la méthode produisent des résultats.`,
    trendDown: (pts, weak) => `Baisse de ${pts} pts${weak ? ` sur "${weak}"` : ''}. En CM2, chaque lacune identifiée mérite une révision ciblée — les bases seront attendues dès la rentrée en 6ème.`,
    flat: (score, weak) =>
      score >= 15 ? `Le niveau est au rendez-vous pour l'entrée en 6ème — continuez sur cette lancée.`
      : score < 10 ? `Il est important de consolider ces lacunes avant le collège.${weak ? ` Commencez par "${weak}".` : ''}`
      : `L'enjeu est maintenant la méthode : relecture systématique, justification des réponses, vérification des calculs.`,
    tip: `En CM2, l'enjeu est la méthode : relecture systématique, justification des réponses, vérification des calculs. Ces réflexes, pris maintenant, feront toute la différence au collège.`,
  },
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

  // ── Resolve child level ────────────────────────────────────────────────────
  const child = getChildren().find(c => c.id === childId)
  const rawLevel = child?.level ?? ''
  const level = PRIMARY_LEVELS_REPORT.includes(rawLevel) ? rawLevel : 'CM1'
  const persona = REPORT_PERSONA[level]

  // ── Level-adapted parentSummary & recommendation ───────────────────────────
  let parentSummary: string
  let recommendation: string

  if (totalCorrections === 0) {
    parentSummary = `Aucun exercice corrigé cette semaine.`
    recommendation = persona.noActivity
  } else if (totalCorrections === 1) {
    parentSummary = persona.single(averageScore, mostWorkedSubject)
    recommendation = persona.tip
  } else {
    const sub = mostWorkedSubject ? ` en ${mostWorkedSubject}` : ''
    parentSummary = `${totalCorrections} exercices corrigés${sub} cette semaine (moy. ${averageScore}/20). ${persona.summaryTone(averageScore)}`

    if (scoreTrend > 1) {
      recommendation = `${persona.trendUp(scoreTrend)} ${persona.tip}`
    } else if (scoreTrend < -1) {
      const weak = weaknesses.length > 0 ? weaknesses[0] : undefined
      recommendation = `${persona.trendDown(Math.abs(scoreTrend), weak)} ${persona.tip}`
    } else {
      const weak = weaknesses.length > 0 ? weaknesses[0] : undefined
      recommendation = `${persona.flat(averageScore, weak)} ${persona.tip}`
    }
  }

  // ── Aggregate parentAdvice from this week's corrections ────────────────────
  const weeklyAdvice = last7
    .map(r => r.correction.parentAdvice)
    .filter((v): v is string => Boolean(v?.trim()))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 3)

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
    level,
    weeklyAdvice: weeklyAdvice.length > 0 ? weeklyAdvice : undefined,
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
      level: report.level,
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
      weeklyAdvice: report.weeklyAdvice,
    },
  }
}
