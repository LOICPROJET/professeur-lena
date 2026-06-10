'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  const tabs = [
    { href: '/', label: 'Accueil', emoji: '🏠', activeEmoji: '🏠' },
    { href: '/history', label: 'Historique', emoji: '🕐', activeEmoji: '🕐' },
    { href: '/progress', label: 'Évolution', emoji: '📈', activeEmoji: '📈' },
  ]

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-sm border-t border-gray-100 z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{isActive ? tab.activeEmoji : tab.emoji}</span>
              <span className={`text-xs font-semibold ${isActive ? 'text-primary-500' : 'text-gray-400'}`}>
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
