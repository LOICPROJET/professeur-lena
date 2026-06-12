'use client'

import { useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { CorrectionResultV2, SUBJECT_EMOJI } from '@/lib/types'

export type { CorrectionResultV2 }

interface ResultCardsProps {
  result: CorrectionResultV2
  subject: string
  onNew: () => void
  /** Prénom de l'enfant actif — utilisé dans BravoBanner */
  childName?: string
  /** Niveau scolaire (CP/CE1/CE2/CM1/CM2) — adapte le message de réconfort */
  childLevel?: string
}

// ─── Score badge ──────────────────────────────────────────────────────────────
export function ScoreBadge({ score, size = 'lg' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color =
    score >= 15 ? 'bg-green-500' :
    score >= 10 ? 'bg-amber-500' :
    'bg-red-500'

  const sizes = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-20 h-20 text-2xl',
  }

  return (
    <div className={`${sizes[size]} ${color} rounded-full flex flex-col items-center justify-center text-white font-black shadow-md flex-shrink-0`}>
      <span>{score}</span>
      <span className="text-[9px] font-bold opacity-80 -mt-1">/20</span>
    </div>
  )
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const pct = Math.round((score / 20) * 100)
  const color = score >= 15 ? 'bg-green-500' : score >= 10 ? 'bg-amber-500' : 'bg-red-500'
  const label = score >= 15 ? 'Excellent !' : score >= 12 ? 'Très bien !' : score >= 10 ? 'Bien !' : 'À retravailler'

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 animate-slide-up">
      <div className="flex items-center gap-4">
        <ScoreBadge score={score} size="lg" />
        <div className="flex-1">
          <div className="flex justify-between items-baseline mb-2">
            <span className="font-black text-lg text-[#1F2937]">{label}</span>
            <span className="text-xs text-[#8E8E93] font-medium">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${color} rounded-full transition-all duration-1000`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Léna message (score < 10) ────────────────────────────────────────────────
// Carte bienveillante affichée AVANT le score pour amortir l'impact émotionnel
// des mauvaises notes. Message adapté au niveau scolaire de l'enfant.

const LENA_LOW_SCORE_MESSAGES: Record<string, string> = {
  CP:  "Ne t'inquiète pas. Les erreurs servent à apprendre. On va y arriver ensemble ! 🌱",
  CE1: "Tu fais déjà des progrès. Regardons ensemble ce qu'on peut améliorer. 💪",
  CE2: "Certaines notions sont encore difficiles. C'est normal, on va les travailler ensemble. 📚",
  CM1: "Ce devoir était difficile. Les erreurs permettent de progresser. Continue ! ⭐",
  CM2: "Ce devoir demande encore un peu d'entraînement. Tu es capable d'y arriver. 🎯",
}

function LenaMessage({ level }: { level?: string }) {
  const message =
    (level && LENA_LOW_SCORE_MESSAGES[level]) ??
    LENA_LOW_SCORE_MESSAGES['CM1']

  return (
    <div className="bg-primary-50 border border-primary-100 rounded-3xl p-4 animate-slide-up" style={{ animationDelay: '0ms' }}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-primary-100 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
          💜
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-black text-primary-500 uppercase tracking-wide mb-1">
            Léna dit :
          </p>
          <p className="text-sm text-primary-800 font-medium leading-snug">
            {message}
          </p>
        </div>
        <div className="text-3xl flex-shrink-0 select-none">👧</div>
      </div>
    </div>
  )
}

// ─── Skills pills ─────────────────────────────────────────────────────────────
function SkillPills({ items, color }: { items: string[]; color: 'green' | 'orange' }) {
  if (!items?.length) return null
  const base = color === 'green'
    ? 'bg-green-100 text-green-700 border-green-200'
    : 'bg-orange-100 text-orange-700 border-orange-200'
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map((skill, i) => (
        <span key={i} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${base}`}>
          {skill}
        </span>
      ))}
    </div>
  )
}

// ─── Accordion card ───────────────────────────────────────────────────────────
interface CardProps {
  icon: string; title: string; content: string
  bgColor: string; borderColor: string; iconBg: string; titleColor: string
  defaultOpen?: boolean; delay?: number
  extra?: React.ReactNode
}

function ResultCard({ icon, title, content, bgColor, borderColor, iconBg, titleColor, defaultOpen = false, delay = 0, extra }: CardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  if (!content?.trim()) return null

  return (
    <div className={`rounded-3xl border ${borderColor} ${bgColor} shadow-sm overflow-hidden animate-slide-up`}
      style={{ animationDelay: `${delay}ms` }}>
      <button className="w-full flex items-center gap-3 p-4 btn-press text-left" onClick={() => setIsOpen(!isOpen)}>
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm`}>{icon}</div>
        <span className={`flex-1 font-bold text-base ${titleColor}`}>{title}</span>
        <span className={`text-gray-400 text-xl transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0">
          <div className="h-px bg-black/5 mb-3" />
          <p className="text-[#1F2937] text-sm font-medium leading-relaxed whitespace-pre-line">{content}</p>
          {extra}
        </div>
      )}
    </div>
  )
}

// ─── Bravo banner ─────────────────────────────────────────────────────────────
function BravoBanner({ content, childName }: { content: string; childName?: string }) {
  if (!content) return null
  // Félicite l'enfant par son prénom — jamais "Bravo Léna !" qui désigne la prof
  const title = childName?.trim() ? `Bravo ${childName.trim()} !` : 'Bravo !'

  return (
    <div className="rounded-3xl p-5 shadow-lg shadow-primary-200/50 animate-slide-up"
      style={{ animationDelay: '480ms', background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)' }}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">🌟</div>
        <div className="flex-1">
          <h3 className="text-white font-black text-base mb-1">{title}</h3>
          <p className="text-white/90 text-sm font-medium leading-snug">{content}</p>
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">👧</div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ResultCards({ result, subject, onNew, childName, childLevel }: ResultCardsProps) {
  const emoji = SUBJECT_EMOJI[subject] || '✨'

  const cards: CardProps[] = [
    {
      icon: '✅', title: 'Ce qui est réussi', content: result.whatIsGood,
      bgColor: 'bg-green-50', borderColor: 'border-green-100',
      iconBg: 'bg-green-100', titleColor: 'text-green-800',
      defaultOpen: true, delay: 80,
      extra: <SkillPills items={result.masteredSkills} color="green" />,
    },
    {
      icon: '⚠️', title: 'Ce qui est à corriger', content: result.whatToCorrect,
      bgColor: 'bg-amber-50', borderColor: 'border-amber-100',
      iconBg: 'bg-amber-100', titleColor: 'text-amber-800',
      defaultOpen: true, delay: 160,
      extra: <SkillPills items={result.weakSkills} color="orange" />,
    },
    {
      icon: '📚', title: 'Explication simple', content: result.simpleExplanation,
      bgColor: 'bg-blue-50', borderColor: 'border-blue-100',
      iconBg: 'bg-blue-100', titleColor: 'text-blue-800',
      defaultOpen: false, delay: 240,
    },
    {
      icon: '💡', title: 'Astuce pour retenir', content: result.memoryTip,
      bgColor: 'bg-yellow-50', borderColor: 'border-yellow-100',
      iconBg: 'bg-yellow-100', titleColor: 'text-yellow-800',
      defaultOpen: false, delay: 320,
    },
    {
      icon: '🎯', title: 'Petit exercice', content: result.smallExercise,
      bgColor: 'bg-purple-50', borderColor: 'border-purple-100',
      iconBg: 'bg-purple-100', titleColor: 'text-purple-800',
      defaultOpen: false, delay: 400,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-4 pb-3">
        <button onClick={onNew} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 btn-press">
          <span className="text-gray-500 text-lg">←</span>
        </button>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-2xl">⭐</span>
          <h2 className="text-2xl font-black text-[#1F2937]">Super, j'ai corrigé !</h2>
        </div>
        <p className="text-sm text-[#8E8E93] font-medium">
          {emoji} {subject} · Regarde, je t'explique tout 😊
        </p>
      </div>

      {/* Message bienveillant Léna — affiché uniquement pour score < 10 */}
      {result.score < 10 && (
        <div className="px-6 mb-2">
          <LenaMessage level={childLevel} />
        </div>
      )}

      {/* Score bar */}
      <div className="px-6 mb-1 animate-slide-up" style={{ animationDelay: '0ms' }}>
        <ScoreBar score={result.score} />
      </div>

      {/* Cards */}
      <div className="px-6 mt-3 flex flex-col gap-3">
        {cards.map((card) => (
          <ResultCard key={card.title} {...card} />
        ))}
        <BravoBanner content={result.encouragement} childName={childName} />
      </div>

      {/* Actions */}
      <div className="px-6 mt-6 flex flex-col gap-3">
        <button onClick={onNew}
          className="w-full text-white font-black text-lg py-4 rounded-2xl shadow-lg btn-press flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)' }}>
          <span>📸</span><span>Nouveau devoir</span>
        </button>
        <Link href="/history"
          className="w-full bg-white text-[#8E8E93] font-bold text-base py-3.5 rounded-2xl border border-gray-100 shadow-sm btn-press flex items-center justify-center gap-2">
          <span>🕐</span><span>Voir mon historique</span>
        </Link>
      </div>

      <div className="h-4" />
      <BottomNav />
    </div>
  )
}
