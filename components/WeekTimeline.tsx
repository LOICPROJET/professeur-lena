'use client'

import { HomeworkRecord } from '@/lib/types'

interface DayData {
  dateKey: string
  label: string
  count: number
  avgScore: number | null
  isToday: boolean
}

function scoreRingClass(score: number): string {
  if (score >= 15) return 'bg-green-500 text-white'
  if (score >= 10) return 'bg-amber-500 text-white'
  return 'bg-red-400 text-white'
}

function getDayLabel(d: Date): string {
  // "lun." → "Lun"
  const raw = d.toLocaleDateString('fr-FR', { weekday: 'short' })
  return raw.charAt(0).toUpperCase() + raw.slice(1, 3)
}

/**
 * 7-day activity timeline — one circle per day.
 * showScore=true (parent):  shows the day's average score inside the circle.
 * showScore=false (child):  shows a ✓ checkmark when the child worked.
 */
export default function WeekTimeline({
  records,
  showScore = true,
}: {
  records: HomeworkRecord[]
  showScore?: boolean
}) {
  const now = new Date()

  const days: DayData[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - (6 - i)) // day[0] = 6 days ago, day[6] = today
    const dateKey = d.toISOString().slice(0, 10)
    const dayRecs = records.filter(r => r.date.slice(0, 10) === dateKey)
    const avgScore = dayRecs.length
      ? Math.round(dayRecs.reduce((s, r) => s + r.correction.score, 0) / dayRecs.length)
      : null
    return {
      dateKey,
      label: getDayLabel(d),
      count: dayRecs.length,
      avgScore,
      isToday: i === 6,
    }
  })

  return (
    <div className="flex justify-between items-end">
      {days.map(d => (
        <div key={d.dateKey} className="flex flex-col items-center gap-1.5 flex-1">
          {/* Score / activity circle */}
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black transition-all ${
              d.avgScore !== null
                ? scoreRingClass(d.avgScore)
                : d.isToday
                  ? 'bg-primary-50 border-2 border-primary-200 text-primary-300'
                  : 'bg-gray-100 text-gray-300'
            }`}
          >
            {d.avgScore !== null
              ? (showScore ? d.avgScore : '✓')
              : '–'}
          </div>

          {/* Day label */}
          <span
            className={`text-[10px] font-semibold ${
              d.isToday ? 'text-primary-500' : 'text-gray-400'
            }`}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}
