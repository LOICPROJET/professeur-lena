'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import SubjectSelector from '@/components/SubjectSelector'
import ResultCards from '@/components/ResultCards'
import CameraCapture from '@/components/CameraCapture'
import BottomNav from '@/components/BottomNav'
import ChildSelector from '@/components/ChildSelector'
import LenaCharacter from '@/components/LenaCharacter'
import SoftLimitBanner from '@/components/SoftLimitBanner'
import PaywallModal from '@/components/PaywallModal'
import Link from 'next/link'
import { CorrectionResultV2, ChildProfile } from '@/lib/types'
import { saveUsage, type UsageMeta } from '@/lib/openai-costs'
import { canCorrect, getMonthlyUsage, getUserPlan, FREE_LIMITS } from '@/lib/quotas'
import {
  saveHomework,
  generateId,
  resizeImageForStorage,
  getChildren,
  getActiveChildId,
  setActiveChildId,
  runMigration,
  canAddChild,
  getOrCreateActiveChild,
  getAllHomework,
  computeStreak,
} from '@/lib/storage'

type Step = 'home' | 'subject' | 'preview' | 'loading' | 'results'

// ─── Child pill (triggers ChildSelector sheet) ────────────────────────────────
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
      className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-sm border border-gray-100 btn-press"
    >
      <span className="text-base">{active.emoji}</span>
      <span className="text-sm font-black text-[#1D1D1F]">{active.name}</span>
      {active.level && (
        <span className="text-xs text-gray-400 font-medium">{active.level}</span>
      )}
      {childCount > 1 && <span className="text-gray-300 text-xs ml-0.5">▾</span>}
      {childCount === 1 && <span className="text-gray-300 text-xs ml-0.5">⌃</span>}
    </button>
  )
}

// ─── Home screen ──────────────────────────────────────────────────────────────
function HomeScreen({
  onCapture,
  activeChild,
  childList,
  onOpenSelector,
  streak,
  correctionsUsed,
}: {
  onCapture: (file: File, dataUrl: string) => void
  activeChild: ChildProfile | null
  childList: ChildProfile[]
  onOpenSelector: () => void
  streak: number
  correctionsUsed: number
}) {
  const name = activeChild ? activeChild.name : 'toi'
  const plan = getUserPlan()
  const isFreePlan = plan === 'free'
  const limit = FREE_LIMITS.correctionsPerMonth

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="h-12" />

      {/* Active child pill */}
      {activeChild && (
        <div className="px-6 pt-3 pb-0 flex justify-center">
          <ChildPill
            active={activeChild}
            childCount={childList.length}
            onClick={onOpenSelector}
          />
        </div>
      )}

      {/* Quota usage counter — free plan only */}
      {isFreePlan && correctionsUsed > 0 && (
        <div className="px-5 pt-2 pb-0">
          <SoftLimitBanner used={correctionsUsed} limit={limit} type="correction" />
        </div>
      )}

      {/* Soft banner — no level set */}
      {activeChild && !activeChild.level && (
        <div className="px-5 pt-2 pb-0">
          <div className="bg-primary-50 border border-primary-100 rounded-2xl px-4 py-3 flex items-center gap-2.5">
            <span className="text-base flex-shrink-0">⭐</span>
            <p className="text-xs font-medium text-primary-800 flex-1 leading-snug">
              Ajoutez la classe de <span className="font-black">{activeChild.name}</span> pour que Léna corrige comme une vraie maîtresse de son niveau.
            </p>
            <Link
              href="/parent"
              className="text-xs font-black text-white bg-primary-500 px-2.5 py-1.5 rounded-xl btn-press flex-shrink-0"
            >
              Compléter le profil
            </Link>
          </div>
        </div>
      )}

      {/* Écran "Prendre mon devoir en photo" — façon maquette */}
      <div className="px-6 pt-4 pb-2 text-center">
        <h1 className="text-2xl font-black text-[#1D1D1F] leading-tight">
          Prendre mon devoir<br />en photo 📸
        </h1>
        <p className="mt-2 text-sm text-[#4B5563] font-medium leading-snug">
          {name === 'toi' ? "Je t'aide" : `${name}, je t'aide`} à comprendre tes erreurs.
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <CameraCapture onCapture={onCapture} variant="circle" />
      </div>

      <BottomNav />
    </div>
  )
}

// ─── Preview screen ───────────────────────────────────────────────────────────
function PreviewScreen({
  imageData,
  subject,
  onCorrect,
  onRetake,
  error,
}: {
  imageData: string
  subject: string
  onCorrect: () => void
  onRetake: () => void
  error: string
}) {
  const subjectEmoji: Record<string, string> = {
    Français: '📖', Maths: '🔢', Anglais: '🇬🇧', Histoire: '🏰', Autre: '✨',
  }
  return (
    <div className="flex flex-col min-h-screen pb-20 animate-fade-in">
      <div className="h-12" />
      <div className="px-6 pt-4 pb-4 flex items-center gap-3">
        <button
          onClick={onRetake}
          className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center btn-press"
        >
          <span className="text-gray-500 text-lg">←</span>
        </button>
        <div>
          <h2 className="text-xl font-black text-[#1D1D1F]">Ton devoir</h2>
          <p className="text-xs text-[#8E8E93] font-medium">
            {subjectEmoji[subject] || '✨'} {subject} · Vérifie ta photo
          </p>
        </div>
      </div>

      {error && (
        <div className="mx-6 mb-3 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-2">
          <span className="text-lg">😅</span>
          <p className="text-sm text-red-600 font-semibold">{error}</p>
        </div>
      )}

      <div className="mx-6 rounded-3xl overflow-hidden shadow-md border-4 border-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageData} alt="Ton devoir" className="w-full object-cover max-h-72" />
      </div>

      <div className="mx-6 mt-3">
        <span className="bg-primary-100 text-primary-600 text-sm font-bold px-3 py-1 rounded-full">
          {subjectEmoji[subject] || '✨'} {subject}
        </span>
      </div>

      <div className="px-6 mt-6 flex flex-col gap-3">
        <button
          onClick={onCorrect}
          className="w-full text-white font-black text-lg py-4 rounded-full shadow-lumio btn-press flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #4F7CFF 0%, #7299FF 100%)' }}
        >
          <span>🚀</span><span>Corriger mon devoir</span>
        </button>
        <button
          onClick={onRetake}
          className="w-full bg-white text-primary-500 font-bold text-base py-3.5 rounded-full border border-primary-200 shadow-card btn-press flex items-center justify-center gap-2"
        >
          <span>🔄</span><span>Reprendre la photo</span>
        </button>
      </div>

      <BottomNav />
    </div>
  )
}

// ─── Loading screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-6 animate-fade-in">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <LenaCharacter size="md" mood="analyse" showName={false} />
        <div className="absolute inset-0 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black text-[#1D1D1F]">Analyse en cours…</h2>
        <p className="mt-2 text-[#8E8E93] font-medium text-base">Je lis attentivement tout 🔍</p>
      </div>
      <div className="flex gap-2">
        <div className="w-3 h-3 bg-primary-400 rounded-full dot-1" />
        <div className="w-3 h-3 bg-primary-400 rounded-full dot-2" />
        <div className="w-3 h-3 bg-primary-400 rounded-full dot-3" />
      </div>
      <p className="text-sm text-[#8E8E93] font-medium bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-50 text-center">
        🌟 Ton professeur Léna analyse tout avec soin !
      </p>
    </div>
  )
}

// ─── Resize image before API call (reduces 3-5 MB → ~300 KB) ─────────────────
async function resizeImageForAPI(dataUrl: string, maxPx = 1024, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob')), 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('home')
  const [subject, setSubject] = useState('')
  const [imageData, setImageData] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [result, setResult] = useState<CorrectionResultV2 | null>(null)
  const [error, setError] = useState('')

  const [childList, setChildList] = useState<ChildProfile[]>([])
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null)
  const [showSelector, setShowSelector] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  const [streak, setStreak] = useState(0)
  const [correctionsUsed, setCorrectionsUsed] = useState(0)
  const [showPaywall, setShowPaywall] = useState(false)

  // Run migration + load children on mount
  // getOrCreateActiveChild() ensures there is always a valid profile
  useEffect(() => {
    runMigration()
    const child = getOrCreateActiveChild()
    setActiveChild(child)
    setChildList(getChildren())
    setStreak(computeStreak(getAllHomework(child.id)))
    // Load monthly quota usage (free plan only)
    setCorrectionsUsed(getMonthlyUsage().corrections)
  }, [])

  const handlePhotoCapture = useCallback((file: File, dataUrl: string) => {
    setImageFile(file)
    setImageData(dataUrl)
    setError('')
    setStep('subject')
  }, [])

  const handleSubjectSelect = useCallback((s: string) => {
    setSubject(s)
    setStep('preview')
  }, [])

  const handleCorrect = useCallback(async () => {
    if (!imageFile && !imageData) return

    // ── Freemium quota check ──────────────────────────────────────────────────
    const quota = canCorrect()
    if (!quota.allowed) {
      setShowPaywall(true)
      return
    }

    setStep('loading')
    setError('')
    setStorageWarning(false)

    // R1 fix: always guarantee a valid child profile before saving
    // getOrCreateActiveChild() creates "Mon enfant" if no profile exists
    const targetChild = activeChild ?? getOrCreateActiveChild()
    if (!activeChild) {
      setActiveChild(targetChild)
      setChildList(getChildren())
    }

    try {
      const resizedBlob = await resizeImageForAPI(imageData)
      const formData = new FormData()
      formData.append('image', resizedBlob, 'homework.jpg')
      formData.append('subject', subject)
      // Niveau scolaire — variable pédagogique centrale
      // Fallback CM1 si le parent n'a pas renseigné la classe (préserve le comportement actuel)
      formData.append('level', targetChild.level ?? 'CM1')

      const response = await fetch('/api/correct-homework', { method: 'POST', body: formData })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur serveur')
      }

      const raw = await response.json() as CorrectionResultV2 & { _usage?: UsageMeta }
      const { _usage, ...data } = raw
      // Best-effort cost tracking — never blocks UX
      try { if (_usage) saveUsage(_usage) } catch { /* silent */ }
      // Refresh monthly usage counter for free plan banner
      setCorrectionsUsed(getMonthlyUsage().corrections)
      setResult(data)

      const thumbnail = await resizeImageForStorage(imageData).catch(() => '')
      const { quotaWarning } = saveHomework(
        {
          id: generateId(),
          date: new Date().toISOString(),
          subject,
          imageDataUrl: thumbnail,
          correction: data,
          childId: targetChild.id,  // Always a valid childId — never orphaned
        },
        targetChild.id,
      )
      if (quotaWarning) setStorageWarning(true)

      setStep('results')
    } catch (err) {
      console.error('Correction error:', err)
      setError("Je n'arrive pas bien à lire la photo, peux-tu la reprendre ?")
      setStep('preview')
    }
  }, [imageFile, subject, imageData, activeChild])

  const handleRetakePhoto = useCallback(() => {
    setImageData(''); setImageFile(null); setError(''); setStep('home')
  }, [])

  const handleNewHomework = useCallback(() => {
    setStep('home'); setSubject(''); setImageData(''); setImageFile(null); setResult(null); setError('')
  }, [])

  const handleChildSwitch = useCallback((c: ChildProfile) => {
    setActiveChildId(c.id)
    setActiveChild(c)
    setStreak(computeStreak(getAllHomework(c.id)))
  }, [])

  const handleAddChild = useCallback(() => {
    router.push('/parent')
  }, [router])

  // Reload child list when returning from parent page (e.g. after adding or editing a child)
  useEffect(() => {
    const onFocus = () => {
      const children = getChildren()
      setChildList(children)
      // Use stored active child — don't create a new profile on focus
      const activeId = getActiveChildId()
      const found = children.find(c => c.id === activeId) ?? children[0] ?? null
      if (found) {
        setActiveChild(found)
        setStreak(computeStreak(getAllHomework(found.id)))
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <main className="min-h-screen bg-transparent max-w-md mx-auto relative overflow-x-hidden">
      {step === 'home' && (
        <HomeScreen
          onCapture={handlePhotoCapture}
          activeChild={activeChild}
          childList={childList}
          onOpenSelector={() => setShowSelector(true)}
          streak={streak}
          correctionsUsed={correctionsUsed}
        />
      )}
      {step === 'subject' && (
        <SubjectSelector onSelect={handleSubjectSelect} onBack={() => setStep('home')} />
      )}
      {step === 'preview' && (
        <PreviewScreen
          imageData={imageData}
          subject={subject}
          onCorrect={handleCorrect}
          onRetake={handleRetakePhoto}
          error={error}
        />
      )}
      {step === 'loading' && <LoadingScreen />}
      {step === 'results' && result && (
        <div>
          {storageWarning && (
            <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 flex items-center gap-2 animate-fade-in"
              style={{ maxWidth: 'calc(100% - 32px)' }}>
              <span>💾</span>
              <span>Stockage presque plein : les anciennes miniatures ont été allégées, mais vos corrections sont conservées.</span>
              <button onClick={() => setStorageWarning(false)} className="ml-1 text-amber-500 font-black text-sm">✕</button>
            </div>
          )}
          <ResultCards
            result={result}
            subject={subject}
            onNew={handleNewHomework}
            childName={activeChild?.name}
            childLevel={activeChild?.level}
          />
        </div>
      )}

      {/* Apple-style child selector bottom sheet */}
      {showSelector && (
        <ChildSelector
          children={childList}
          activeId={activeChild?.id ?? null}
          canAdd={canAddChild()}
          onSelect={handleChildSwitch}
          onAdd={handleAddChild}
          onClose={() => setShowSelector(false)}
        />
      )}

      {/* Freemium paywall modal */}
      {showPaywall && (
        <PaywallModal
          type="correction"
          onClose={() => setShowPaywall(false)}
        />
      )}
    </main>
  )
}
