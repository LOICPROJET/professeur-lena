'use client'

// ─── Récompenses — façon maquette ─────────────────────────────────────────────
// Carte Niveau (mascotte diplômée + XP), grille "Mes badges", collection.
// Badges : computeBadges (lib/storage). XP/niveau : lib/gamification.

import { useState, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'
import LenaCharacter from '@/components/LenaCharacter'
import { HomeworkRecord, Badge } from '@/lib/types'
import { getOrCreateActiveChild, getAllHomework, runMigration, computeBadges } from '@/lib/storage'
import { computeLevel } from '@/lib/gamification'

function BadgeTile({ badge }: { badge: Badge }) {
  return (
    <div
      className={`rounded-3xl p-3 border text-center animate-slide-up ${
        badge.unlocked
          ? 'bg-white border-app-border shadow-card'
          : 'bg-gray-50 border-gray-100 opacity-50'
      }`}
    >
      <div className={`text-3xl mb-1 ${badge.unlocked ? '' : 'grayscale'}`}>{badge.emoji}</div>
      <p className="text-xs font-black text-[#1D1D1F] leading-tight">{badge.label}</p>
      <p className="text-[10px] text-[#4B5563] font-medium mt-0.5 leading-tight">{badge.description}</p>
    </div>
  )
}

export default function RecompensesPage() {
  const [records, setRecords] = useState<HomeworkRecord[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    runMigration()
    const child = getOrCreateActiveChild()
    setRecords(getAllHomework(child.id))
    setMounted(true)
  }, [])

  const level = computeLevel(records)
  const badges = computeBadges(records)
  const unlockedCount = badges.filter(b => b.unlocked).length
  const pct = Math.round((level.xpInLevel / level.xpForNext) * 100)

  return (
    <main className="min-h-screen bg-transparent max-w-md mx-auto relative overflow-x-hidden">
      <div className="flex flex-col min-h-screen pb-24">
        <div className="h-12" />

        <div className="px-6 pt-4 pb-2 text-center">
          <h1 className="text-[28px] font-black text-[#1D1D1F]">Mes récompenses 🏆</h1>
          <p className="mt-1 text-sm text-[#4B5563] font-medium">
            Continue de progresser pour tout débloquer !
          </p>
        </div>

        {mounted && (
          <div className="px-5 mt-4 flex flex-col gap-3 card-stagger">
            {/* Carte Niveau — mascotte + titre + XP façon maquette */}
            <div className="bg-white rounded-3xl p-5 shadow-card border border-app-border animate-slide-up text-center">
              <div className="flex justify-center mb-2 relative">
                <LenaCharacter size="md" mood="felicitations" showName={false} />
                <span className="absolute -mt-1 ml-16 text-2xl">🎓</span>
              </div>
              <p className="font-black text-xl text-[#1D1D1F]">Niveau {level.level}</p>
              <p className="text-sm font-bold text-primary-500">{level.title}</p>
              <div className="mt-3 flex items-center gap-2 max-w-[240px] mx-auto">
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #4F7CFF, #7299FF)' }} />
                </div>
                <span className="text-xs font-bold text-[#4B5563]">{level.xpInLevel} / {level.xpForNext} XP</span>
              </div>
            </div>

            {/* Grille badges */}
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-black text-[#4B5563] uppercase tracking-wide">Mes badges</p>
                <span className="text-xs font-bold text-primary-500">{unlockedCount}/{badges.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {badges.map(b => <BadgeTile key={b.id} badge={b} />)}
              </div>
            </div>

            {/* Encouragement */}
            {unlockedCount < badges.length && (
              <div className="bg-primary-50 border border-primary-100 rounded-3xl p-4 animate-slide-up flex items-center gap-3">
                <LenaCharacter size="sm" showName={false} />
                <p className="text-sm text-primary-800 font-medium leading-snug flex-1">
                  Encore {badges.length - unlockedCount} badge{badges.length - unlockedCount > 1 ? 's' : ''} à débloquer.
                  Chaque devoir corrigé te rapproche du prochain !
                </p>
              </div>
            )}
          </div>
        )}

        <BottomNav />
      </div>
    </main>
  )
}
