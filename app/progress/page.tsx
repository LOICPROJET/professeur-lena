'use client'

import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { getAllHomework, computeBadges, computeProgressStats, computeStreak, computeBestStreak, getStreakMessage, getOrCreateActiveChild, ProgressStats } from '@/lib/storage'
import { HomeworkRecord, Badge, ChildProfile, SUBJECT_EMOJI } from '@/lib/types'
import WeekTimeline from '@/components/WeekTimeline'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 15) return { bar: 'bg-green-500', text: 'text-green-600', light: 'bg-green-100' }
  if (score >= 10) return { bar: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-100' }
  return { bar: 'bg-red-500', text: 'text-red-600', light: 'bg-red-100' }
}

function avg(nums: number[]) {
  if (!nums.length) return 0
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

// ─── Mini SVG line chart ──────────────────────────────────────────────────────

function LineChart({ points }: { points: { label: string; score: number }[] }) {
  if (points.length < 2) return (
    <p className="text-sm text-gray-400 italic text-center py-4">Fais au moins 2 exercices pour voir la courbe.</p>
  )

  const W = 300; const H = 100; const PAD = 12
  const scores = points.map(p => p.score)
  const min = Math.max(0, Math.min(...scores) - 2)
  const max = Math.min(20, Math.max(...scores) + 2)
  const range = max - min || 1

  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const y = (s: number) => H - PAD - ((s - min) / range) * (H - PAD * 2)

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${x(points.length - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`

  const lastScore = points[points.length - 1].score
  const firstScore = points[0].score
  const trend = lastScore > firstScore ? '↑' : lastScore < firstScore ? '↓' : '→'
  const trendColor = lastScore > firstScore ? 'text-green-500' : lastScore < firstScore ? 'text-red-500' : 'text-gray-400'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-medium">10 derniers exercices</span>
        <span className={`text-sm font-black ${trendColor}`}>{trend} {lastScore}/20</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[5, 10, 15, 20].map(v => (
          <line key={v} x1={PAD} y1={y(v)} x2={W - PAD} y2={y(v)}
            stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3" />
        ))}
        {/* Area fill */}
        <path d={areaD} fill="url(#areaGrad)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.score)} r="3.5"
            fill="white" stroke="#8B5CF6" strokeWidth="2" />
        ))}
      </svg>
      {/* Labels */}
      <div className="flex justify-between mt-1 px-2">
        <span className="text-[10px] text-gray-400">{points[0].label}</span>
        <span className="text-[10px] text-gray-400">{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}

// ─── Subject bar ──────────────────────────────────────────────────────────────

function SubjectBar({ subject, average, count }: { subject: string; average: number; count: number }) {
  const c = scoreColor(average)
  const emoji = SUBJECT_EMOJI[subject] || '✨'
  const pct = Math.round((average / 20) * 100)

  return (
    <div className="flex items-center gap-3">
      <span className="text-xl w-7 flex-shrink-0">{emoji}</span>
      <div className="flex-1">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm font-bold text-[#1F2937]">{subject}</span>
          <span className={`text-sm font-black ${c.text}`}>{average}/20</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${c.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">{count} exercice{count > 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center gap-1 text-center">
      <span className="text-2xl">{icon}</span>
      <span className="text-xl font-black text-[#1F2937]">{value}</span>
      <span className="text-[11px] font-semibold text-[#8E8E93] leading-tight">{label}</span>
    </div>
  )
}

// ─── Badge tile ──────────────────────────────────────────────────────────────

function BadgeTile({ badge }: { badge: Badge }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center ${
      badge.unlocked
        ? 'bg-white border-primary-200 shadow-sm'
        : 'bg-gray-50 border-gray-100 opacity-50'
    }`}>
      <span className={`text-3xl ${badge.unlocked ? '' : 'grayscale'}`} style={badge.unlocked ? {} : { filter: 'grayscale(1)' }}>
        {badge.emoji}
      </span>
      <span className={`text-xs font-black leading-tight ${badge.unlocked ? 'text-[#1F2937]' : 'text-gray-400'}`}>
        {badge.label}
      </span>
      <span className="text-[10px] text-gray-400 leading-tight">{badge.description}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [records, setRecords] = useState<HomeworkRecord[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null)

  useEffect(() => {
    const child = getOrCreateActiveChild()
    setActiveChild(child)
    const hw = getAllHomework(child.id)
    setRecords(hw)
    setBadges(computeBadges(hw))
    setProgressStats(computeProgressStats(hw))
    setLoaded(true)
  }, [])

  if (!loaded) return (
    <div className="min-h-screen bg-[#F9FAF8] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-300 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  // ── Derived stats ────────────────────────────────────────────────────────────
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const last10 = sorted.slice(-10).map(r => ({
    label: new Date(r.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    score: r.correction.score,
  }))

  const globalAvg = avg(records.map(r => r.correction.score))
  const streak = computeStreak(records)
  const bestStreak = computeBestStreak(records)
  const streakMsg = getStreakMessage(streak)

  // Per subject
  const bySubject: Record<string, number[]> = {}
  for (const r of records) {
    if (!bySubject[r.subject]) bySubject[r.subject] = []
    bySubject[r.subject].push(r.correction.score)
  }
  const subjectStats = Object.entries(bySubject)
    .map(([subject, scores]) => ({ subject, average: avg(scores), count: scores.length }))
    .sort((a, b) => b.average - a.average)

  // 7-day trend
  const now = Date.now()
  const last7 = records.filter(r => now - new Date(r.date).getTime() < 7 * 86400000)
  const prev7 = records.filter(r => {
    const age = now - new Date(r.date).getTime()
    return age >= 7 * 86400000 && age < 14 * 86400000
  })
  const avg7 = avg(last7.map(r => r.correction.score))
  const avgPrev7 = avg(prev7.map(r => r.correction.score))
  const trendVal = last7.length && prev7.length ? avg7 - avgPrev7 : null

  const globalColor = scoreColor(globalAvg)

  // Empty state
  if (!records.length) return (
    <div className="min-h-screen bg-[#F9FAF8] max-w-md mx-auto flex flex-col pb-24">
      <div className="h-12" />
      <div className="px-6 pt-4 pb-3">
        <h1 className="text-2xl font-black text-[#1F2937]">
          {activeChild ? `${activeChild.emoji} ${activeChild.name}` : 'Mon Évolution'} 📈
        </h1>
        <p className="text-sm text-[#8E8E93] font-medium mt-1">Tes progrès au fil du temps</p>
      </div>
      <div className="px-5 flex flex-col gap-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
          <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 text-sm font-semibold text-primary-700 leading-snug">
            Aucun exercice cette semaine. Tu peux reprendre quand tu veux ! 💪
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Ma semaine</p>
            <WeekTimeline records={[]} showScore={false} />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-8 gap-3">
          <div className="text-6xl">📚</div>
          <p className="font-bold text-[#1F2937] text-center">Aucun exercice pour l'instant</p>
          <p className="text-sm text-[#8E8E93] text-center">Fais corriger ton premier devoir pour voir tes progrès ici !</p>
        </div>
      </div>
      <BottomNav />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F9FAF8] max-w-md mx-auto pb-24">
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-4 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-black text-[#1F2937]">
            {activeChild ? `${activeChild.emoji} ${activeChild.name}` : 'Mon Évolution'} 📈
          </h1>
          {activeChild?.level && (
            <span className="text-xs font-black text-white bg-primary-500 px-2 py-0.5 rounded-lg">
              {activeChild.level}
            </span>
          )}
        </div>
        <p className="text-sm text-[#8E8E93] font-medium mt-1">Tes progrès au fil du temps</p>
      </div>

      <div className="px-5 flex flex-col gap-4">

        {/* Stat chips — 2 colonnes (streak est sa propre carte) */}
        <div className="grid grid-cols-2 gap-3">
          <StatChip icon="📝" value={records.length} label="Exercices" />
          <StatChip
            icon={globalAvg >= 15 ? '⭐' : globalAvg >= 10 ? '📈' : '📌'}
            value={`${globalAvg}/20`}
            label="Moyenne"
          />
        </div>

        {/* Carte streak — visuellement prioritaire */}
        <div className={`rounded-3xl p-4 border ${
          streak > 0
            ? 'bg-orange-50 border-orange-200'
            : 'bg-gray-50 border-gray-100'
        }`}>
          <div className="flex items-center justify-between">
            {/* Série actuelle */}
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
                streak > 0 ? 'bg-orange-100' : 'bg-gray-100'
              }`}>
                🔥
              </div>
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-wide ${streak > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                  Série actuelle
                </p>
                <p className={`text-2xl font-black ${streak > 0 ? 'text-orange-700' : 'text-gray-400'}`}>
                  {streak} {streak === 1 ? 'jour' : 'jours'}
                </p>
              </div>
            </div>
            {/* Meilleure série */}
            <div className="text-right">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Meilleure</p>
              <p className="text-2xl font-black text-[#1F2937]">
                🏆 {bestStreak}
              </p>
              <p className="text-[11px] text-gray-400 font-medium">{bestStreak === 1 ? 'jour' : 'jours'}</p>
            </div>
          </div>
          {/* Message motivant */}
          {streakMsg && (
            <p className={`text-sm font-semibold mt-3 pt-3 border-t ${
              streak > 0 ? 'text-orange-700 border-orange-200' : 'text-gray-500 border-gray-200'
            }`}>
              {streakMsg}
            </p>
          )}
          {streak === 0 && (
            <p className="text-sm font-medium text-gray-400 mt-3 pt-3 border-t border-gray-200">
              Fais un exercice aujourd'hui pour commencer une série ! 🌱
            </p>
          )}
        </div>

        {/* Motivational message + 7/30-day activity */}
        {progressStats && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
            {/* Message enfant */}
            {(() => {
              const n = progressStats.last7DaysCount
              let msg = ''
              let color = 'bg-primary-50 border-primary-100 text-primary-700'
              if (n === 0) {
                msg = 'Aucun exercice cette semaine. Tu peux reprendre quand tu veux ! 💪'
                color = 'bg-gray-50 border-gray-200 text-gray-600'
              } else if (n >= 5) {
                msg = `Bravo, tu as travaillé ${n} fois cette semaine ! Tu es super assidu(e) ! 🌟`
                color = 'bg-green-50 border-green-100 text-green-700'
              } else if (n >= 3) {
                msg = `Bravo, tu as travaillé ${n} fois cette semaine ! Continue comme ça ! 🔥`
                color = 'bg-green-50 border-green-100 text-green-700'
              } else if (n === 1) {
                msg = `Tu as fait 1 exercice cette semaine. Chaque effort compte ! 🌱`
                color = 'bg-primary-50 border-primary-100 text-primary-700'
              } else {
                msg = `Tu as fait ${n} exercices cette semaine. Bien joué ! ⭐`
                color = 'bg-primary-50 border-primary-100 text-primary-700'
              }
              return (
                <div className={`rounded-xl border px-4 py-3 text-sm font-semibold leading-snug ${color}`}>
                  {msg}
                </div>
              )
            })()}

            {/* 7-day timeline */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                Ma semaine
              </p>
              <WeekTimeline records={records} showScore={false} />
            </div>

            {/* 7j / 30j quick stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-primary-50 rounded-xl p-3 text-center">
                <p className="text-[11px] font-bold text-primary-600">7 jours</p>
                <p className="font-black text-xl text-primary-700">{progressStats.last7DaysCount}</p>
                <p className="text-[11px] text-primary-500">
                  {progressStats.last7DaysAverage > 0 ? `moy. ${progressStats.last7DaysAverage}/20` : 'exercice(s)'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[11px] font-bold text-gray-500">30 jours</p>
                <p className="font-black text-xl text-[#1F2937]">{progressStats.last30DaysCount}</p>
                <p className="text-[11px] text-gray-400">
                  {progressStats.last30DaysAverage > 0 ? `moy. ${progressStats.last30DaysAverage}/20` : 'exercice(s)'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 7-day trend */}
        {trendVal !== null && (
          <div className={`rounded-2xl p-4 flex items-center gap-3 ${trendVal >= 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
            <span className="text-2xl">{trendVal >= 0 ? '📈' : '📉'}</span>
            <div>
              <p className={`font-bold text-sm ${trendVal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {trendVal >= 0 ? `+${trendVal} pts cette semaine` : `${trendVal} pts cette semaine`}
              </p>
              <p className="text-xs text-gray-500">par rapport aux 7 jours précédents</p>
            </div>
          </div>
        )}

        {/* Line chart */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-black text-base text-[#1F2937] mb-4">Courbe de progression</h3>
          <LineChart points={last10} />
        </div>

        {/* By subject */}
        {subjectStats.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-black text-base text-[#1F2937] mb-4">Par matière</h3>
            <div className="flex flex-col gap-4">
              {subjectStats.map(s => (
                <SubjectBar key={s.subject} {...s} />
              ))}
            </div>
          </div>
        )}

        {/* Best / worst */}
        {subjectStats.length >= 2 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-green-600 mb-1">💪 Point fort</p>
              <p className="font-black text-[#1F2937] text-sm">{subjectStats[0].subject}</p>
              <p className="text-green-600 font-black">{subjectStats[0].average}/20</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-orange-600 mb-1">📌 À renforcer</p>
              <p className="font-black text-[#1F2937] text-sm">{subjectStats[subjectStats.length - 1].subject}</p>
              <p className="text-orange-600 font-black">{subjectStats[subjectStats.length - 1].average}/20</p>
            </div>
          </div>
        )}

        {/* Badges */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-black text-base text-[#1F2937]">Mes badges 🏅</h3>
            <span className="text-xs text-gray-400 font-semibold">
              {badges.filter(b => b.unlocked).length}/{badges.length} débloqués
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {badges.map(b => <BadgeTile key={b.id} badge={b} />)}
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  )
}
