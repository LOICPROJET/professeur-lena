// ─── Gamification Lumio ───────────────────────────────────────────────────────
// XP, niveau, titre et défi du jour — entièrement DÉRIVÉS de l'historique
// localStorage existant (HomeworkRecord[]). Aucune écriture, aucun appel API :
// le même historique produit toujours le même état. Zéro risque de désync.

import { HomeworkRecord } from './types'

// ─── XP ───────────────────────────────────────────────────────────────────────
// Chaque devoir corrigé rapporte 20 XP + bonus selon la note.
export function xpForRecord(r: HomeworkRecord): number {
  const s = r.correction?.score ?? 0
  if (s >= 18) return 50
  if (s >= 15) return 40
  if (s >= 10) return 30
  return 20 // on récompense l'effort, jamais 0
}

export function computeTotalXp(records: HomeworkRecord[]): number {
  return records.reduce((sum, r) => sum + xpForRecord(r), 0)
}

// ─── Niveau ───────────────────────────────────────────────────────────────────
// Coût progressif : niveau n → n+1 coûte 100 + 25×(n−1) XP (100, 125, 150…)
export interface LevelInfo {
  level: number
  title: string
  xpInLevel: number      // XP accumulés dans le niveau courant
  xpForNext: number      // XP nécessaires pour passer au niveau suivant
  totalXp: number
}

const TITLES = [
  'Petit Curieux',       // 1
  'Explorateur',         // 2
  'Apprenti Malin',      // 3
  'Détective des Devoirs', // 4
  'As du Cahier',        // 5
  'Cerveau Vif',         // 6
  'Champion en Herbe',   // 7
  'Étoile Montante',     // 8
  'Super Élève',         // 9
  'Grand Penseur',       // 10
  'Maître des Leçons',   // 11
  'Apprenti Génie',      // 12
  'Génie Confirmé',      // 13
  'Légende de la Classe', // 14
]

export function levelTitle(level: number): string {
  return TITLES[Math.min(level, TITLES.length) - 1]
}

export function computeLevel(records: HomeworkRecord[]): LevelInfo {
  const totalXp = computeTotalXp(records)
  let level = 1
  let rest = totalXp
  let cost = 100
  while (rest >= cost) {
    rest -= cost
    level += 1
    cost = 100 + 25 * (level - 1)
  }
  return { level, title: levelTitle(level), xpInLevel: rest, xpForNext: cost, totalXp }
}

// ─── Aujourd'hui ──────────────────────────────────────────────────────────────
export interface TodayInfo {
  count: number   // devoirs corrigés aujourd'hui
  xp: number      // XP gagnés aujourd'hui
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

export function computeToday(records: HomeworkRecord[]): TodayInfo {
  const todays = records.filter(r => isToday(r.date))
  return { count: todays.length, xp: todays.reduce((s, r) => s + xpForRecord(r), 0) }
}

// ─── Défi du jour ─────────────────────────────────────────────────────────────
// Déterministe selon la date — tout le monde a le même défi le même jour.
export interface DailyChallenge {
  id: string
  emoji: string
  label: string
  rewardXp: number
  goal: number
  progress: number
  done: boolean
}

const CHALLENGES: { id: string; emoji: string; label: string; goal: number; match: (r: HomeworkRecord) => boolean }[] = [
  { id: 'three', emoji: '⭐', label: 'Corrige 3 exercices', goal: 3, match: () => true },
  { id: 'maths', emoji: '🔢', label: 'Réussis 2 exercices en maths', goal: 2, match: r => r.subject === 'Maths' && r.correction.score >= 10 },
  { id: 'good', emoji: '🎯', label: 'Obtiens au moins 15/20', goal: 1, match: r => r.correction.score >= 15 },
  { id: 'francais', emoji: '📖', label: 'Corrige un devoir de français', goal: 1, match: r => r.subject === 'Français' },
  { id: 'two', emoji: '✨', label: 'Corrige 2 exercices', goal: 2, match: () => true },
]

export function computeDailyChallenge(records: HomeworkRecord[]): DailyChallenge {
  const now = new Date()
  const dayIndex = Math.floor(now.getTime() / 86_400_000)
  const c = CHALLENGES[dayIndex % CHALLENGES.length]
  const progress = Math.min(c.goal, records.filter(r => isToday(r.date) && c.match(r)).length)
  return {
    id: c.id,
    emoji: c.emoji,
    label: c.label,
    rewardXp: 50,
    goal: c.goal,
    progress,
    done: progress >= c.goal,
  }
}

// ─── Progression par matière (pour les barres de l'accueil) ──────────────────
export interface SubjectProgress {
  subject: string
  pct: number      // moyenne /20 → %
  count: number
}

const BAR_COLORS: Record<string, string> = {
  Maths: '#4F7CFF',
  Français: '#FF9F0A',
  Anglais: '#FF6B6B',
  Histoire: '#A78BFA',
  Autre: '#34C759',
}

export function subjectBarColor(subject: string): string {
  return BAR_COLORS[subject] ?? '#4F7CFF'
}

export function computeSubjectProgress(records: HomeworkRecord[]): SubjectProgress[] {
  const by: Record<string, number[]> = {}
  for (const r of records) {
    if (!by[r.subject]) by[r.subject] = []
    by[r.subject].push(r.correction.score)
  }
  return Object.entries(by)
    .map(([subject, scores]) => ({
      subject,
      pct: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length / 20) * 100),
      count: scores.length,
    }))
    .sort((a, b) => b.count - a.count)
}
