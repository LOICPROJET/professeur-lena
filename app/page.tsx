'use client'

// ─── Accueil Lumio — façon maquette ──────────────────────────────────────────
// Bonjour + mascotte, carte Niveau/XP, carte Aujourd'hui, Progression par
// matière, Défi du jour, CTA caméra. Toutes les stats sont DÉRIVÉES de
// l'historique localStorage (lib/gamification.ts) — aucune logique serveur.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import ChildSelector from '@/components/ChildSelector'
import LenaCharacter from '@/components/LenaCharacter'
import { ChildProfile, HomeworkRecord } from '@/lib/types'
import {
  getChildren,
  getActiveChildId,
  setActiveChildId,
  runMigration,
  canAddChild,
  getOrCreateActiveChild,
  getAllHomework,
  computeStreak,
} from '@/lib/storage'
import {
  computeLevel,
  computeToday,
  computeDailyChallenge,
  computeSubjectProgress,
  subjectBarColor,
  LevelInfo,
  TodayInfo,
  DailyChallenge,
  SubjectProgress,
} from '@/lib/gamification'

// ─── Pill enfant (ouvre le sélecteur) ────────────────────────────────────────
function ChildPill({
  active,
  childCount,
  onClick,
}: {
  active: ChildProfile
  childCount: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-card border border-app-border btn-press"
    >
      <span className="text-base">{active.emoji}</span>
      <span className="text-sm font-black text-[#1D1D1F]">{active.name}</span>
      {active.level && (
        <span className="text-xs text-gray-400 font-medium">{active.level}</span>
      )}
      <span className="text-gray-300 text-xs ml-0.5">{childCount > 1 ? '▾' : '⌃'}</span>
    </button>
  )
}

// ─── Carte Niveau / XP ────────────────────────────────────────────────────────
function LevelCard({ level }: { level: LevelInfo }) {
  const pct = Math.round((level.xpInLevel / level.xpForNext) * 100)
  return (
    <div className="bg-white rounded-3xl p-4 shadow-card border border-app-border animate-slide-up">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-black text-base text-[#1D1D1F]">Niveau {level.level}</p>
          <p className="text-xs text-[#4B5563] font-semibold">{level.title}</p>
        </div>
        <span className="w-9 h-9 rounded-full bg-[#FFF4DE] flex items-center justify-center text-lg">⭐</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #4F7CFF, #7299FF)' }} />
        </div>
        <span className="text-xs font-bold text-[#4B5563] flex-shrink-0">
          {level.xpInLevel} / {level.xpForNext} XP
        </span>
      </div>
    </div>
  )
}

// ─── Carte Aujourd'hui ────────────────────────────────────────────────────────
function TodayCard({ today }: { today: TodayInfo }) {
  return (
    <div className="bg-white rounded-3xl p-4 shadow-card border border-app-border animate-slide-up">
      <p className="text-xs font-black text-[#4B5563] uppercase tracking-wide mb-2">Aujourd&apos;hui</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-10" /></svg>
          </span>
          <span className="text-sm font-bold text-[#1D1D1F]">
            {today.count === 0
              ? 'Aucun exercice pour le moment'
              : `${today.count} exercice${today.count > 1 ? 's' : ''} corrigé${today.count > 1 ? 's' : ''}`}
          </span>
        </div>
        {today.xp > 0 && (
          <span className="text-sm font-black text-warning">+ {today.xp} XP</span>
        )}
      </div>
    </div>
  )
}

// ─── Carte Progression ────────────────────────────────────────────────────────
function ProgressCard({ subjects }: { subjects: SubjectProgress[] }) {
  if (!subjects.length) return null
  return (
    <div className="bg-white rounded-3xl p-4 shadow-card border border-app-border animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black text-[#4B5563] uppercase tracking-wide">Progression</p>
        <Link href="/progress" className="text-xs font-bold text-primary-500 btn-press">Tout voir ›</Link>
      </div>
      <div className="flex flex-col gap-2.5">
        {subjects.slice(0, 3).map(s => (
          <div key={s.subject} className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#1D1D1F] w-16 flex-shrink-0">{s.subject}</span>
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${s.pct}%`, backgroundColor: subjectBarColor(s.subject) }} />
            </div>
            <span className="text-xs font-bold text-[#4B5563] w-9 text-right flex-shrink-0">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Carte Défi du jour ───────────────────────────────────────────────────────
function ChallengeCard({ challenge }: { challenge: DailyChallenge }) {
  const pct = Math.round((challenge.progress / challenge.goal) * 100)
  return (
    <Link href="/defis" className="block bg-white rounded-3xl p-4 shadow-card border border-app-border animate-slide-up btn-press">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-2xl flex-shrink-0">🎁</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-primary-500 uppercase tracking-wide">Défi du jour</p>
          <p className="text-sm font-bold text-[#1D1D1F] leading-snug">
            {challenge.label} et gagne {challenge.rewardXp} XP !
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-bold text-[#4B5563]">{challenge.progress}/{challenge.goal}</span>
          </div>
        </div>
        <span className="text-gray-300 text-lg flex-shrink-0">›</span>
      </div>
    </Link>
  )
}

// ─── Accueil ──────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter()

  const [childList, setChildList] = useState<ChildProfile[]>([])
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null)
  const [showSelector, setShowSelector] = useState(false)
  const [records, setRecords] = useState<HomeworkRecord[]>([])
  const [mounted, setMounted] = useState(false)

  const loadFor = (childId: string) => {
    setRecords(getAllHomework(childId))
  }

  useEffect(() => {
    runMigration()
    const child = getOrCreateActiveChild()
    setActiveChild(child)
    setChildList(getChildren())
    loadFor(child.id)
    setMounted(true)
  }, [])

  // Recharge au retour sur l'app (ex: après une correction)
  useEffect(() => {
    const onFocus = () => {
      const children = getChildren()
      setChildList(children)
      const activeId = getActiveChildId()
      const found = children.find(c => c.id === activeId) ?? children[0] ?? null
      if (found) {
        setActiveChild(found)
        loadFor(found.id)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const handleChildSwitch = (c: ChildProfile) => {
    setActiveChildId(c.id)
    setActiveChild(c)
    loadFor(c.id)
  }

  const name = activeChild ? activeChild.name : 'toi'
  const level = computeLevel(records)
  const today = computeToday(records)
  const challenge = computeDailyChallenge(records)
  const subjects = computeSubjectProgress(records)
  const streak = computeStreak(records)

  return (
    <main className="min-h-screen bg-transparent max-w-md mx-auto relative overflow-x-hidden">
      <div className="flex flex-col min-h-screen pb-24">
        <div className="h-12" />

        {/* Header : bonjour + pill enfant */}
        <div className="px-6 pt-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-black text-[#1D1D1F] leading-tight">
              Bonjour {name} ! 👋
            </h1>
            <p className="mt-1 text-base text-[#4B5563] font-medium">
              Prêt{activeChild?.emoji === '👧' ? 'e' : ''} à apprendre aujourd&apos;hui ?
            </p>
          </div>
        </div>

        {activeChild && mounted && (
          <div className="px-6 pt-3 flex items-center gap-2">
            <ChildPill
              active={activeChild}
              childCount={childList.length}
              onClick={() => setShowSelector(true)}
            />
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-black px-2.5 py-1.5 rounded-full">
                🔥 {streak} {streak === 1 ? 'jour' : 'jours'}
              </span>
            )}
          </div>
        )}

        {/* Avatar enfant + mascotte Lumio côte à côte (façon maquette) */}
        <div className="flex justify-center items-end gap-4 mt-5 mb-2">
          {activeChild && (
            <div className="w-20 h-20 rounded-full bg-white shadow-card border border-app-border flex items-center justify-center text-4xl">
              {activeChild.emoji}
            </div>
          )}
          <LenaCharacter size="md" showName={false} />
        </div>

        {/* Cartes — niveau, aujourd'hui, progression, défi */}
        <div className="px-5 mt-4 flex flex-col gap-3 card-stagger">
          {mounted && <LevelCard level={level} />}
          {mounted && <TodayCard today={today} />}
          {mounted && <ProgressCard subjects={subjects} />}
          {mounted && <ChallengeCard challenge={challenge} />}

          {/* Accès rapides — Devoirs / Réviser */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/history" className="bg-white rounded-3xl p-4 shadow-card border border-app-border btn-press flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-[#FFF4DE] flex items-center justify-center text-lg">🕐</span>
              <span className="text-sm font-bold text-[#1D1D1F]">Mes devoirs</span>
            </Link>
            <Link href="/revise" className="bg-white rounded-3xl p-4 shadow-card border border-app-border btn-press flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-primary-50 flex items-center justify-center text-lg">🧠</span>
              <span className="text-sm font-bold text-[#1D1D1F]">Réviser</span>
            </Link>
          </div>
        </div>

        {/* CTA principal */}
        <div className="px-6 mt-6">
          <button
            onClick={() => router.push('/corriger')}
            className="w-full text-white font-black text-lg py-4 rounded-full shadow-lumio btn-press flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #4F7CFF 0%, #7299FF 100%)' }}
          >
            <span>📸</span><span>Prendre mon devoir en photo</span>
          </button>
        </div>

        <BottomNav />
      </div>

      {/* Sélecteur d'enfant */}
      {showSelector && (
        <ChildSelector
          children={childList}
          activeId={activeChild?.id ?? null}
          canAdd={canAddChild()}
          onSelect={handleChildSwitch}
          onAdd={() => router.push('/parent')}
          onClose={() => setShowSelector(false)}
        />
      )}
    </main>
  )
}
