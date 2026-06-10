'use client'

import { useState, useCallback } from 'react'
import SubjectSelector from '@/components/SubjectSelector'
import ResultCards from '@/components/ResultCards'
import CameraCapture from '@/components/CameraCapture'
import BottomNav from '@/components/BottomNav'
import { CorrectionResultV2, ChildProfile } from '@/lib/types'
import { saveHomework, generateId, resizeImageForStorage, getChildren, getActiveChildId, setActiveChildId } from '@/lib/storage'

type Step = 'home' | 'subject' | 'preview' | 'loading' | 'results'

// ─── Léna character ───────────────────────────────────────────────────────────
function LenaCharacter() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="w-44 h-44 relative animate-bounce-gentle">
        <div className="absolute inset-0 bg-primary-200 rounded-full opacity-30 scale-110" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center shadow-lg">
          <div className="text-center select-none">
            <div className="text-7xl leading-none">👧</div>
            <div className="mt-1 text-xs font-bold text-primary-600 tracking-wide">Léna</div>
          </div>
        </div>
        <div className="absolute -top-2 -right-2 text-2xl animate-pulse">✨</div>
        <div className="absolute -bottom-1 -left-2 text-xl animate-pulse" style={{ animationDelay: '0.5s' }}>⭐</div>
      </div>
    </div>
  )
}

// ─── Child switcher ───────────────────────────────────────────────────────────
function ChildSwitcher({ active, children, onSwitch }: {
  active: ChildProfile | null
  children: ChildProfile[]
  onSwitch: (c: ChildProfile) => void
}) {
  const [open, setOpen] = useState(false)
  if (!active) return null

  return (
    <div className="relative flex justify-center">
      <button
        onClick={() => children.length > 1 && setOpen(o => !o)}
        className={`flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-sm border border-gray-100 ${children.length > 1 ? 'btn-press' : ''}`}
      >
        <span className="text-base">{active.emoji}</span>
        <span className="text-sm font-bold text-[#1F2937]">{active.name}</span>
        <span className="text-xs text-gray-400 font-medium">{active.level}</span>
        {children.length > 1 && <span className="text-gray-400 text-xs ml-0.5">▾</span>}
      </button>
      {open && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-lg border border-gray-100 z-50 overflow-hidden min-w-[160px]">
          {children.map(c => (
            <button key={c.id} onClick={() => { onSwitch(c); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-bold btn-press ${c.id === active.id ? 'bg-primary-50 text-primary-600' : 'text-[#1F2937]'}`}>
              <span>{c.emoji}</span><span>{c.name}</span><span className="text-xs text-gray-400 font-medium ml-auto">{c.level}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Home screen ──────────────────────────────────────────────────────────────
function HomeScreen({ onCapture, activeChild, children, onSwitch }: {
  onCapture: (file: File, dataUrl: string) => void
  activeChild: ChildProfile | null
  children: ChildProfile[]
  onSwitch: (c: ChildProfile) => void
}) {
  const name = activeChild ? activeChild.name : 'toi'
  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="h-12" />
      {activeChild && (
        <div className="px-6 pt-3 pb-0 flex justify-center">
          <ChildSwitcher active={activeChild} children={children} onSwitch={onSwitch} />
        </div>
      )}
      <div className="px-6 pt-3 pb-2 text-center">
        <h1 className="text-3xl font-black text-[#1F2937] leading-tight">
          Bonjour {name} 👋
        </h1>
        <p className="mt-2 text-base text-[#8E8E93] font-medium leading-snug">
          Prends ton devoir en photo,<br />
          je vais t'aider à comprendre.
        </p>
      </div>
      <div className="flex justify-center mt-6 mb-8">
        <LenaCharacter />
      </div>
      <div className="px-6 mt-auto">
        <CameraCapture onCapture={onCapture} />
      </div>
      <BottomNav />
    </div>
  )
}

// ─── Preview screen ───────────────────────────────────────────────────────────
function PreviewScreen({
  imageData, subject, onCorrect, onRetake, error,
}: {
  imageData: string; subject: string; onCorrect: () => void
  onRetake: () => void; error: string
}) {
  const subjectEmoji: Record<string, string> = {
    Français: '📖', Maths: '🔢', Anglais: '🇬🇧', Histoire: '🏰', Autre: '✨',
  }
  return (
    <div className="flex flex-col min-h-screen pb-20 animate-fade-in">
      <div className="h-12" />
      <div className="px-6 pt-4 pb-4 flex items-center gap-3">
        <button onClick={onRetake} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center btn-press">
          <span className="text-gray-500 text-lg">←</span>
        </button>
        <div>
          <h2 className="text-xl font-black text-[#1F2937]">Ton devoir</h2>
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
        <button onClick={onCorrect} className="w-full text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-primary-200 btn-press flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)' }}>
          <span>🚀</span><span>Corriger mon devoir</span>
        </button>
        <button onClick={onRetake} className="w-full bg-white text-[#8E8E93] font-bold text-base py-3.5 rounded-2xl border border-gray-100 shadow-sm btn-press flex items-center justify-center gap-2">
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
      <div className="relative">
        <div className="w-32 h-32 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center shadow-lg animate-pulse-soft">
          <span className="text-6xl">👧</span>
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-primary-300 border-t-primary-500 animate-spin" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black text-[#1F2937]">Je regarde<br />ton devoir…</h2>
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

// ─── Resize image before sending to API (reduces 3-5 MB phone photos to ~300 KB) ─
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
  const [step, setStep] = useState<Step>('home')
  const [subject, setSubject] = useState('')
  const [imageData, setImageData] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [result, setResult] = useState<CorrectionResultV2 | null>(null)
  const [error, setError] = useState('')
  const [childList, setChildList] = useState<ChildProfile[]>([])
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null)

  // Load children on mount
  useState(() => {
    const children = getChildren()
    setChildList(children)
    const activeId = getActiveChildId()
    const found = children.find(c => c.id === activeId) ?? children[0] ?? null
    if (found && found.id !== activeId) setActiveChildId(found.id)
    setActiveChild(found)
  })

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
    setStep('loading')
    setError('')

    try {
      // Resize before upload — phone cameras produce 3-5 MB, Vercel limit is ~4.5 MB
      const resizedBlob = await resizeImageForAPI(imageData)
      const formData = new FormData()
      formData.append('image', resizedBlob, 'homework.jpg')
      formData.append('subject', subject)

      const response = await fetch('/api/correct-homework', { method: 'POST', body: formData })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur serveur')
      }

      const data: CorrectionResultV2 = await response.json()
      setResult(data)

      // Save to history (resize image first for storage efficiency)
      const thumbnail = await resizeImageForStorage(imageData).catch(() => '')
      saveHomework({
        id: generateId(),
        date: new Date().toISOString(),
        subject,
        imageDataUrl: thumbnail,
        correction: data,
        childId: activeChild?.id,
      }, activeChild?.id)

      setStep('results')
    } catch (err) {
      console.error('Correction error:', err)
      setError("Je n'arrive pas bien à lire la photo, peux-tu la reprendre ?")
      setStep('preview')
    }
  }, [imageFile, subject, imageData])

  const handleRetakePhoto = useCallback(() => {
    setImageData(''); setImageFile(null); setError(''); setStep('home')
  }, [])

  const handleNewHomework = useCallback(() => {
    setStep('home'); setSubject(''); setImageData(''); setImageFile(null); setResult(null); setError('')
  }, [])

  const handleChildSwitch = useCallback((c: ChildProfile) => {
    setActiveChildId(c.id)
    setActiveChild(c)
  }, [])

  return (
    <main className="min-h-screen bg-[#F9FAF8] max-w-md mx-auto relative overflow-x-hidden">
      {step === 'home' && (
        <HomeScreen
          onCapture={handlePhotoCapture}
          activeChild={activeChild}
          children={childList}
          onSwitch={handleChildSwitch}
        />
      )}
      {step === 'subject' && <SubjectSelector onSelect={handleSubjectSelect} onBack={() => setStep('home')} />}
      {step === 'preview' && (
        <PreviewScreen imageData={imageData} subject={subject}
          onCorrect={handleCorrect} onRetake={handleRetakePhoto} error={error} />
      )}
      {step === 'loading' && <LoadingScreen />}
      {step === 'results' && result && (
        <ResultCards result={result} subject={subject} onNew={handleNewHomework} />
      )}
    </main>
  )
}
