'use client'

import LenaCharacter from '@/components/LenaCharacter'

interface SubjectSelectorProps {
  onSelect: (subject: string) => void
  onBack: () => void
}

const subjects = [
  { label: 'Français', emoji: '📖', color: 'from-blue-50 to-blue-100', border: 'border-blue-100', text: 'text-blue-700', active: 'bg-blue-500' },
  { label: 'Maths', emoji: '🔢', color: 'from-green-50 to-green-100', border: 'border-green-100', text: 'text-green-700', active: 'bg-green-500' },
  { label: 'Anglais', emoji: '🇬🇧', color: 'from-red-50 to-red-100', border: 'border-red-100', text: 'text-red-700', active: 'bg-red-500' },
  { label: 'Histoire', emoji: '🏰', color: 'from-yellow-50 to-yellow-100', border: 'border-yellow-100', text: 'text-yellow-700', active: 'bg-yellow-500' },
  { label: 'Autre', emoji: '✨', color: 'from-purple-50 to-purple-100', border: 'border-purple-100', text: 'text-purple-700', active: 'bg-purple-500' },
]

export default function SubjectSelector({ onSelect, onBack }: SubjectSelectorProps) {
  return (
    <div className="flex flex-col min-h-screen pb-20 animate-fade-in">
      {/* Status bar */}
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-4 pb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center btn-press mb-4"
        >
          <span className="text-gray-500 text-lg">←</span>
        </button>
        <h2 className="text-2xl font-black text-[#1D1D1F]">Quelle matière ? 🎒</h2>
        <p className="mt-1 text-sm text-[#8E8E93] font-medium">
          Choisis la matière de ton devoir
        </p>
      </div>

      {/* Subject list */}
      <div className="px-6 flex flex-col gap-3 card-stagger">
        {subjects.map((subject) => (
          <button
            key={subject.label}
            onClick={() => onSelect(subject.label)}
            className={`
              w-full bg-gradient-to-r ${subject.color}
              border ${subject.border}
              rounded-2xl py-4 px-5
              flex items-center gap-4
              shadow-sm btn-press
              animate-slide-up
            `}
          >
            <span className="text-3xl">{subject.emoji}</span>
            <span className={`text-lg font-bold ${subject.text}`}>
              {subject.label}
            </span>
            <span className="ml-auto text-gray-300 text-lg">›</span>
          </button>
        ))}
      </div>

      {/* Encouragement */}
      <div className="px-6 mt-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-center gap-3">
          <span className="flex-shrink-0"><LenaCharacter size="sm" showName={false} /></span>
          <p className="text-sm text-[#4B5563] font-medium leading-snug">
            Je suis prêt à t&apos;aider pour toutes les matières !
          </p>
        </div>
      </div>
    </div>
  )
}
