'use client'

// ─── Défis — façon maquette ───────────────────────────────────────────────────
// Défi du jour (étoile sur podium, progression, +50 XP) + état du jour.
// Tout est dérivé de l'historique localStorage — voir lib/gamification.ts.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import LenaCharacter from '@/components/LenaCharacter'
import { HomeworkRecord } from '@/lib/types'
import { getOrCreateActiveChild, getAllHomework, runMigration } from '@/lib/storage'
import { computeDailyChallenge, computeToday, computeLevel } from '@/lib/gamification'

export default function DefisPage() {
  const [records, setRecords] = useState<HomeworkRecord[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    runMigration()
    const child = getOrCreateActiveChild()
    setRecords(getAllHomework(child.id))
    setMounted(true)
  }, [])

  const challenge = computeDailyChallenge(records)
  const today = computeToday(records)
  const level = computeLevel(records)
  const pct = Math.round((challenge.progress / challenge.goal) * 100)

  return (
    <main className="min-h-screen bg-transparent max-w-md mx-auto relative overflow-x-hidden">
      <div className="flex flex-col min-h-screen pb-24">
        <div className="h-12" />

        <div className="px-6 pt-4 pb-2 text-center">
          <h1 className="text-[28px] font-black text-[#1D1D1F]">Défi du jour 🎯</h1>
          <p className="mt-1 text-sm text-[#4B5563] font-medium">
            Un nouveau défi chaque jour pour progresser !
          </p>
        </div>

        {mounted && (
          <div className="px-5 mt-4 flex flex-col gap-3 card-stagger">
            {/* Carte défi principale — étoile sur podium façon maquette */}
            <div className="bg-white rounded-3xl p-6 shadow-card border border-app-border animate-slide-up text-center">
              <div className="flex justify-center mb-3">
                <div className="relative">
                  <span className="text-6xl">{challenge.done ? '🏆' : '🌟'}</span>
                  {challenge.done && (
                    <span className="absolute -top-1 -right-3 text-xl twinkle-a">🎉</span>
                  )}
                </div>
              </div>
              <p className="font-black text-lg text-[#1D1D1F]">{challenge.label}</p>
              <div className="mt-4 flex items-center gap-2 max-w-[220px] mx-auto">
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-bold text-[#4B5563]">{challenge.progress}/{challenge.goal}</span>
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 bg-primary-500 text-white text-sm font-black px-4 py-2 rounded-full shadow-lumio">
                <span>{challenge.done ? '✓ Défi réussi !' : `+ ${challenge.rewardXp} XP`}</span>
              </div>
            </div>

            {/* Encouragement Lumio */}
            <div className="bg-primary-50 border border-primary-100 rounded-3xl p-4 animate-slide-up flex items-center gap-3">
              <LenaCharacter size="sm" mood={challenge.done ? 'felicitations' : 'curieux'} showName={false} />
              <p className="text-sm text-primary-800 font-medium leading-snug flex-1">
                {challenge.done
                  ? 'Bravo ! Tu as relevé le défi du jour. Reviens demain pour un nouveau défi ! 🎉'
                  : challenge.progress > 0
                    ? 'Tu y es presque, continue comme ça ! 💪'
                    : 'Prends un devoir en photo pour commencer le défi !'}
              </p>
            </div>

            {/* Stats du jour */}
            <div className="bg-white rounded-3xl p-4 shadow-card border border-app-border animate-slide-up">
              <p className="text-xs font-black text-[#4B5563] uppercase tracking-wide mb-2">Aujourd&apos;hui</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#1D1D1F]">
                  {today.count} exercice{today.count > 1 ? 's' : ''} · Niveau {level.level}
                </span>
                {today.xp > 0 && <span className="text-sm font-black text-warning">+ {today.xp} XP</span>}
              </div>
            </div>

            {/* CTA */}
            <Link
              href="/corriger"
              className="w-full text-white font-black text-lg py-4 rounded-full shadow-lumio btn-press flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #4F7CFF 0%, #7299FF 100%)' }}
            >
              <span>📸</span><span>Je m&apos;entraîne</span>
            </Link>
          </div>
        )}

        <BottomNav />
      </div>
    </main>
  )
}
