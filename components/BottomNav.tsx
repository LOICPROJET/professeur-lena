'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ─── Bottom nav Lumio — onglets de la maquette ────────────────────────────────
// Accueil · Corriger · Défis · Récompenses · Parent
// Icônes SVG arrondies (style SF Symbols), état actif bleu Lumio #4F7CFF.

function Icon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? '#4F7CFF' : '#9CA3AF'
  const fill = active ? '#DEE8FF' : 'none'
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
          <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" fill={fill} />
          <path d="M9.5 20.5v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5" />
        </svg>
      )
    case 'camera':
      return (
        <svg {...common}>
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1l1.2-1.8A1.5 1.5 0 0 1 10 3.5h4a1.5 1.5 0 0 1 1.3.7L16.5 6h1A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z" fill={fill} />
          <circle cx="12" cy="12.5" r="3.2" />
        </svg>
      )
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" fill={fill} />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" fill={stroke} />
        </svg>
      )
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" fill={fill} />
          <path d="M8 5H5.5a1 1 0 0 0-1 1c0 2 1.2 3.5 3.5 3.8M16 5h2.5a1 1 0 0 1 1 1c0 2-1.2 3.5-3.5 3.8" />
          <path d="M12 14v3.5M9 20.5h6M10 17.5h4" />
        </svg>
      )
    case 'parent':
      return (
        <svg {...common}>
          <circle cx="9" cy="8.5" r="3" fill={fill} />
          <circle cx="16.5" cy="10" r="2.4" fill={fill} />
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
    { href: '/', label: 'Accueil', icon: 'home', also: ['/history', '/progress', '/revise'] },
    { href: '/corriger', label: 'Corriger', icon: 'camera', also: [] },
    { href: '/defis', label: 'Défis', icon: 'target', also: [] },
    { href: '/recompenses', label: 'Récompenses', icon: 'trophy', also: [] },
    { href: '/parent', label: 'Parent', icon: 'parent', also: ['/reports', '/premium'] },
  ]

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-md border-t border-app-border z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || tab.also.includes(pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors"
            >
              <Icon name={tab.icon} active={isActive} />
              <span className={`text-[10px] font-semibold ${isActive ? 'text-primary-500' : 'text-gray-400'}`}>
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
