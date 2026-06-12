'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ─── Bottom nav style maquette Lumio ──────────────────────────────────────────
// Icônes SVG arrondies (style SF Symbols), état actif bleu Lumio #4F7CFF.
// Routes inchangées — design uniquement.

function Icon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? '#4F7CFF' : '#9CA3AF'
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" fill={active ? '#DEE8FF' : 'none'} />
          <path d="M9.5 20.5v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5" />
        </svg>
      )
    case 'history':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" fill={active ? '#DEE8FF' : 'none'} />
          <path d="M12 7.5V12l3 2" />
        </svg>
      )
    case 'progress':
      return (
        <svg {...common}>
          <rect x="4" y="13" width="3.6" height="7" rx="1.4" fill={active ? '#DEE8FF' : 'none'} />
          <rect x="10.2" y="9" width="3.6" height="11" rx="1.4" fill={active ? '#DEE8FF' : 'none'} />
          <rect x="16.4" y="5" width="3.6" height="15" rx="1.4" fill={active ? '#DEE8FF' : 'none'} />
        </svg>
      )
    case 'revise':
      return (
        <svg {...common}>
          <path d="M12 3.5a6 6 0 0 1 3.6 10.8c-.7.5-1.1 1.2-1.1 2v.2h-5v-.2c0-.8-.4-1.5-1.1-2A6 6 0 0 1 12 3.5Z" fill={active ? '#DEE8FF' : 'none'} />
          <path d="M10 19.5h4M10.8 21.5h2.4" />
        </svg>
      )
    case 'parent':
      return (
        <svg {...common}>
          <circle cx="9" cy="8.5" r="3" fill={active ? '#DEE8FF' : 'none'} />
          <circle cx="16.5" cy="10" r="2.4" fill={active ? '#DEE8FF' : 'none'} />
          <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
          <path d="M15.5 14.8c2.6.2 4.8 2 4.8 4.7" />
        </svg>
      )
    default:
      return null
  }
}

export default function BottomNav() {
  const pathname = usePathname()

  const tabs = [
    { href: '/', label: 'Accueil', icon: 'home' },
    { href: '/history', label: 'Devoirs', icon: 'history' },
    { href: '/progress', label: 'Progrès', icon: 'progress' },
    { href: '/revise', label: 'Réviser', icon: 'revise' },
    { href: '/parent', label: 'Parent', icon: 'parent' },
  ]

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-md border-t border-app-border z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href ||
            (tab.href === '/parent' && pathname === '/reports')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors"
            >
              <Icon name={tab.icon} active={isActive} />
              <span className={`text-[11px] font-semibold ${isActive ? 'text-primary-500' : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
      {/* iOS home indicator */}
      <div className="h-1 w-32 bg-gray-300 rounded-full mx-auto mb-1" />
    </div>
  )
}
