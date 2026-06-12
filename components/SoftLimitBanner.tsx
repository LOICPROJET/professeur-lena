'use client'

import Link from 'next/link'

interface SoftLimitBannerProps {
  used: number
  limit: number
  type: 'correction' | 'quiz'
}

export default function SoftLimitBanner({ used, limit, type }: SoftLimitBannerProps) {
  const remaining = limit - used
  if (remaining > 5) return null

  const label = type === 'correction' ? 'correction' : 'quiz'
  const labelPlural = type === 'correction' ? 'corrections' : 'quiz'

  let bg = 'bg-amber-50 border-amber-200'
  let text = 'text-amber-800'
  let icon = '⚠️'

  if (remaining <= 2) {
    bg = 'bg-red-50 border-red-200'
    text = 'text-red-800'
    icon = '🔴'
  }

  return (
    <div className={`mx-4 mb-3 rounded-2xl border px-4 py-3 flex items-center gap-3 ${bg}`}>
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${text}`}>
          {remaining === 1
            ? `Plus qu'1 ${label} gratuit${type === 'correction' ? 'e' : ''} ce mois`
            : `${remaining} ${labelPlural} gratuites restantes ce mois`}
        </p>
        <p className={`text-[11px] font-medium mt-0.5 ${text} opacity-80`}>
          {used}/{limit} utilisées
        </p>
      </div>
      <Link
        href="/premium"
        className="flex-shrink-0 bg-white border border-current rounded-xl px-3 py-1.5 text-xs font-black btn-press"
        style={{ color: remaining <= 2 ? '#DC2626' : '#92400E' }}
      >
        Passer Premium
      </Link>
    </div>
  )
}
