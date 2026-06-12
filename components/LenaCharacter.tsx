'use client'

// ─── Mascotte Lumio — blob bleu de la maquette ────────────────────────────────
// Même API qu'avant (size sm/md/lg) pour ne rien casser, + prop mood optionnelle.
// États : content (défaut) · curieux · reflechit · felicitations · analyse

type LenaSize = 'sm' | 'md' | 'lg'
export type LumioMood = 'content' | 'curieux' | 'reflechit' | 'felicitations' | 'analyse'

const PX: Record<LenaSize, number> = { sm: 64, md: 112, lg: 176 }

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
        {/* Halo doux */}
        <div
          className="absolute inset-0 rounded-full opacity-25 scale-110"
          style={{ background: 'radial-gradient(circle, #7299FF 0%, transparent 70%)' }}
        />
        <LumioSvg mood={mood} />

        {/* Étincelles */}
        <span className="absolute -top-1 -right-1 twinkle-a" style={{ fontSize: px * 0.16 }}>✨</span>
        <span className="absolute -bottom-0.5 -left-1 twinkle-b" style={{ fontSize: px * 0.13 }}>⭐</span>
        {mood === 'felicitations' && (
          <span className="absolute -top-2 left-0 twinkle-c" style={{ fontSize: px * 0.18 }}>🎉</span>
        )}
        {mood === 'curieux' && (
          <span className="absolute -top-2 right-2 float-c font-black text-primary-400" style={{ fontSize: px * 0.2 }}>?</span>
        )}
      </div>
      {showName && size !== 'sm' && (
        <div className="mt-1 text-xs font-bold text-primary-600 tracking-wide">Lumio</div>
      )}
    </div>
  )
}

// ─── SVG du blob ──────────────────────────────────────────────────────────────
function LumioSvg({ mood }: { mood: LumioMood }) {
  // Yeux et bouche selon l'humeur
  const closed = mood === 'reflechit'
  const bigSmile = mood === 'felicitations' || mood === 'content'

  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="lumioBody" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#D6E4FF" />
          <stop offset="45%" stopColor="#9BBAFF" />
          <stop offset="100%" stopColor="#6E8FFF" />
        </radialGradient>
        <radialGradient id="lumioShine" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Corps blob arrondi avec petites oreilles */}
      <path
        d="M60 8
           C78 8 96 18 103 36
           C110 54 108 78 96 92
           C84 106 36 106 24 92
           C12 78 10 54 17 36
           C24 18 42 8 60 8 Z"
        fill="url(#lumioBody)"
      />
      {/* Petites pointes (haut) */}
      <path d="M34 14 q-5 -8 2 -11 q4 5 3 10 z" fill="#9BBAFF" />
      <path d="M86 14 q5 -8 -2 -11 q-4 5 -3 10 z" fill="#9BBAFF" />

      {/* Reflet */}
      <ellipse cx="42" cy="30" rx="16" ry="10" fill="url(#lumioShine)" />

      {/* Yeux */}
      {closed ? (
        <g stroke="#1D2A52" strokeWidth="3.4" strokeLinecap="round" fill="none">
          <path d="M38 56 q6 5 12 0" />
          <path d="M70 56 q6 5 12 0" />
        </g>
      ) : (
        <g>
          <ellipse cx="44" cy="56" rx="8.5" ry="10" fill="#1D2A52" />
          <ellipse cx="76" cy="56" rx="8.5" ry="10" fill="#1D2A52" />
          <circle cx="47" cy="52" r="3.2" fill="#fff" />
          <circle cx="79" cy="52" r="3.2" fill="#fff" />
          <circle cx="42" cy="59" r="1.6" fill="#fff" opacity="0.8" />
          <circle cx="74" cy="59" r="1.6" fill="#fff" opacity="0.8" />
        </g>
      )}

      {/* Joues roses */}
      <ellipse cx="30" cy="68" rx="6.5" ry="4" fill="#FFA8C5" opacity="0.7" />
      <ellipse cx="90" cy="68" rx="6.5" ry="4" fill="#FFA8C5" opacity="0.7" />

      {/* Bouche */}
      {bigSmile ? (
        <path d="M46 74 q14 14 28 0 q-4 12 -14 12 q-10 0 -14 -12 z" fill="#3D2B4F" />
      ) : mood === 'analyse' ? (
        <ellipse cx="60" cy="79" rx="6" ry="5" fill="#3D2B4F" />
      ) : (
        <path d="M50 77 q10 8 20 0" stroke="#3D2B4F" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      )}

      {/* Langue dans le grand sourire */}
      {bigSmile && <path d="M52 80 q8 7 16 0 q-3 6 -8 6 q-5 0 -8 -6 z" fill="#FF7BA9" />}
    </svg>
  )
}
