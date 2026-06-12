'use client'

// ─── Mascotte Lumio — vraies illustrations PNG (public/lumio/) ────────────────
// Même API qu'avant (size sm/md/lg, mood, showName) pour ne rien casser.
// Poses : content → coucou · curieux → questions · analyse → lecture
//         felicitations → fête · reflechit → pensif · idee → ampoule

import Image from 'next/image'

type LenaSize = 'sm' | 'md' | 'lg'
export type LumioMood = 'content' | 'curieux' | 'reflechit' | 'felicitations' | 'analyse' | 'idee'

const PX: Record<LenaSize, number> = { sm: 64, md: 130, lg: 200 }

const POSE: Record<LumioMood, string> = {
  content: '/lumio/hello.png',
  curieux: '/lumio/curieux.png',
  analyse: '/lumio/lecture.png',
  felicitations: '/lumio/fete.png',
  reflechit: '/lumio/pense.png',
  idee: '/lumio/idee.png',
}

interface LenaCharacterProps {
  size?: LenaSize
  mood?: LumioMood
  /** Affiche le nom sous la mascotte (md/lg) */
  showName?: boolean
}

export default function LenaCharacter({
  size = 'lg',
  mood = 'content',
  showName = true,
}: LenaCharacterProps) {
  const px = PX[size]

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <div className="relative animate-bounce-gentle" style={{ width: px, height: px }}>
        {/* Halo doux derrière la mascotte */}
        <div
          className="absolute inset-0 rounded-full opacity-30 scale-110"
          style={{ background: 'radial-gradient(circle, #9BBAFF 0%, transparent 70%)' }}
        />
        <Image
          src={POSE[mood]}
          alt="Lumio"
          width={px}
          height={px}
          priority={size === 'lg'}
          className="relative w-full h-full object-contain drop-shadow-sm"
        />
      </div>
      {showName && size !== 'sm' && (
        <div className="mt-1 text-xs font-bold text-primary-600 tracking-wide">Lumio</div>
      )}
    </div>
  )
}
