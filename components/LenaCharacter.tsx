'use client'

// ─── Shared Léna mascot — used on Accueil, Réviser, and any screen needing her presence
// size="lg"  → 176px (Accueil centrepiece)
// size="md"  → 112px (Réviser header, secondary screens)
// size="sm"  →  64px (inline, cards)

type LenaSize = 'sm' | 'md' | 'lg'

interface SizeConfig {
  outer: string
  emoji: string
  /** className for the name label — null hides the label */
  name: string | null
  star1: string
  star2: string
}

const SIZES: Record<LenaSize, SizeConfig> = {
  sm: {
    outer: 'w-16 h-16',
    emoji: 'text-3xl',
    name: null,
    star1: 'absolute -top-1 -right-1 text-base animate-pulse',
    star2: 'absolute -bottom-0.5 -left-1 text-sm animate-pulse',
  },
  md: {
    outer: 'w-28 h-28',
    emoji: 'text-5xl',
    name: 'mt-0.5 text-[10px] font-bold text-primary-600 tracking-wide',
    star1: 'absolute -top-1.5 -right-1.5 text-xl animate-pulse',
    star2: 'absolute -bottom-1 -left-1.5 text-base animate-pulse',
  },
  lg: {
    outer: 'w-44 h-44',
    emoji: 'text-7xl',
    name: 'mt-1 text-xs font-bold text-primary-600 tracking-wide',
    star1: 'absolute -top-2 -right-2 text-2xl animate-pulse',
    star2: 'absolute -bottom-1 -left-2 text-xl animate-pulse',
  },
}

interface LenaCharacterProps {
  size?: LenaSize
}

export default function LenaCharacter({ size = 'lg' }: LenaCharacterProps) {
  const cfg = SIZES[size]

  return (
    <div className="relative flex items-center justify-center">
      <div className={`${cfg.outer} relative animate-bounce-gentle`}>
        <div className="absolute inset-0 bg-primary-200 rounded-full opacity-30 scale-110" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center shadow-lg">
          <div className="text-center select-none">
            <div className={`${cfg.emoji} leading-none`}>👧</div>
            {cfg.name !== null && (
              <div className={cfg.name}>Léna</div>
            )}
          </div>
        </div>
        <div className={cfg.star1}>✨</div>
        <div className={cfg.star2} style={{ animationDelay: '0.5s' }}>⭐</div>
      </div>
    </div>
  )
}
