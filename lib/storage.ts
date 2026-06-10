import { HomeworkRecord, Badge } from './types'

const STORAGE_KEY = 'professeur-lena-history'
const MAX_RECORDS = 100

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

export function getAllHomework(): HomeworkRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function getHomeworkById(id: string): HomeworkRecord | null {
  return getAllHomework().find((r) => r.id === id) ?? null
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function saveHomework(record: HomeworkRecord): void {
  if (typeof window === 'undefined') return

  const tryWrite = (records: HomeworkRecord[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  }

  const existing = getAllHomework()
  const updated = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, MAX_RECORDS)

  try {
    tryWrite(updated)
  } catch {
    // Quota exceeded → strip images and retry
    try {
      const stripped = updated.map((r) => ({ ...r, imageDataUrl: '' }))
      tryWrite(stripped)
    } catch {
      console.warn('[Léna] Could not save to localStorage (quota exceeded)')
    }
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteHomework(id: string): void {
  if (typeof window === 'undefined') return
  const updated = getAllHomework().filter((r) => r.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
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
