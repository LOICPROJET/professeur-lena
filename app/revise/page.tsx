'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'
import CameraCapture from '@/components/CameraCapture'
import SubjectSelector from '@/components/SubjectSelector'
import LenaCharacter from '@/components/LenaCharacter'
import { QuizQuestion, QuizResult } from '@/lib/types'
import { getOrCreateActiveChild } from '@/lib/storage'
import { saveUsage, type UsageMeta } from '@/lib/openai-costs'
import { canQuiz } from '@/lib/quotas'
import PaywallModal from '@/components/PaywallModal'

type Step = 'home' | 'subject' | 'loading-questions' | 'quiz' | 'loading-check' | 'results'

// ─── Resize image (same as main page) ────────────────────────────────────────
async function resizeImage(dataUrl: string, maxPx = 1024, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob')), 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

// ─── Score color ──────────────────────────────────────────────────────────────
function scoreStyle(score: number) {
  if (score >= 15) return { bg: 'bg-green-500', label: 'Excellent ! 🎉', banner: 'bg-green-50 border-green-100', text: 'text-green-700' }
  if (score >= 10) return { bg: 'bg-amber-500', label: 'Bien ! Continue 💪', banner: 'bg-amber-50 border-amber-100', text: 'text-amber-700' }
  return { bg: 'bg-red-500', label: 'À retravailler 📚', banner: 'bg-red-50 border-red-100', text: 'text-red-700' }
}

// ─── Loading screen ───────────────────────────────────────────────────────────
function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-6 animate-fade-in">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <LenaCharacter size="md" mood="analyse" showName={false} />
        <div className="absolute inset-0 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black text-[#1D1D1F]">{message}</h2>
        <p className="mt-2 text-[#8E8E93] font-medium text-base">Un instant… 🔍</p>
      </div>
    </div>
  )
}

// ─── Home screen ──────────────────────────────────────────────────────────────
function HomeScreen({ onCapture }: { onCapture: (file: File, dataUrl: string) => void }) {
  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="h-12" />
      <div className="px-6 pt-4 pb-2 text-center">
        <div className="flex justify-center mb-3">
          <LenaCharacter size="md" />
        </div>
        <h1 className="text-3xl font-black text-[#1D1D1F] leading-tight">Réviser ma leçon</h1>
        <p className="mt-2 text-base text-[#8E8E93] font-medium leading-snug">
          Prends ta leçon en photo,<br />
          je vais créer des questions pour toi !
        </p>
      </div>
      <div className="mx-6 mt-5 mb-6 bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col gap-3">
          {[
            { icon: '📸', text: 'Tu prends ta leçon en photo' },
            { icon: '❓', text: 'Je crée 5 à 7 questions' },
            { icon: '✍️', text: 'Tu réponds à chaque question' },
            { icon: '✅', text: 'Je corrige et t\'explique' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-xl w-8 text-center">{icon}</span>
              <span className="text-sm font-semibold text-[#1D1D1F]">{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-6 mt-auto">
        <CameraCapture onCapture={onCapture} />
      </div>
      <BottomNav />
    </div>
  )
}

// ─── Quiz screen ──────────────────────────────────────────────────────────────
function QuizScreen({
  title, imagePreview, questions, onSubmit, onBack,
}: {
  title: string
  imagePreview: string
  questions: QuizQuestion[]
  onSubmit: (answers: Record<number, string>) => void
  onBack: () => void
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const formRef = useRef<HTMLDivElement>(null)

  const setAnswer = (id: number, value: string) => setAnswers(prev => ({ ...prev, [id]: value }))
  const answeredCount = Object.values(answers).filter(a => a.trim()).length
  const allAnswered = answeredCount === questions.length

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-4 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center btn-press flex-shrink-0">
          <span className="text-gray-500 text-lg">←</span>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[#1D1D1F] truncate">🧠 {title}</h2>
          <p className="text-xs text-[#8E8E93] font-medium">{answeredCount}/{questions.length} réponses</p>
        </div>
      </div>

      {/* Thumbnail */}
      {imagePreview && (
        <div className="mx-6 mb-3 rounded-2xl overflow-hidden border-2 border-white shadow-sm max-h-32">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Leçon" className="w-full object-cover" />
        </div>
      )}

      {/* Progress bar */}
      <div className="mx-6 mb-4 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary-400 rounded-full transition-all duration-300"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      {/* Questions */}
      <div ref={formRef} className="px-6 flex flex-col gap-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 animate-slide-up"
            style={{ animationDelay: `${idx * 60}ms` }}>
            <div className="flex items-start gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                {q.id}
              </span>
              <p className="text-sm font-bold text-[#1D1D1F] leading-snug flex-1">{q.question}</p>
            </div>
            <textarea
              value={answers[q.id] ?? ''}
              onChange={e => setAnswer(q.id, e.target.value)}
              placeholder="Ta réponse ici…"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] bg-gray-50 focus:outline-none focus:border-primary-400 focus:bg-white resize-none transition-colors"
            />
          </div>
        ))}

        {/* Submit */}
        <div className="flex flex-col gap-2 mt-2 mb-4">
          <button
            onClick={() => onSubmit(answers)}
            disabled={!allAnswered}
            className="w-full text-white font-black text-lg py-4 rounded-2xl shadow-lg btn-press flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #4F7CFF 0%, #7299FF 100%)' }}
          >
            <span>🚀</span>
            <span>{allAnswered ? 'Valider mes réponses' : `Réponds à toutes les questions (${answeredCount}/${questions.length})`}</span>
          </button>
          {!allAnswered && (
            <button
              onClick={() => onSubmit(answers)}
              className="w-full bg-white text-gray-400 font-bold text-sm py-3 rounded-2xl border border-gray-100 btn-press"
            >
              Soumettre quand même
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

// ─── Results screen ───────────────────────────────────────────────────────────
function ResultsScreen({
  title, result, questions, answers, onRetry, onNew,
}: {
  title: string
  result: QuizResult
  questions: QuizQuestion[]
  answers: Record<number, string>
  onRetry: () => void
  onNew: () => void
}) {
  const s = scoreStyle(result.score)
  const correct = result.results.filter(r => r.correct).length
  const total = questions.length

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-4 pb-3">
        <button onClick={onNew} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 btn-press">
          <span className="text-gray-500 text-lg">←</span>
        </button>
        <h2 className="text-2xl font-black text-[#1D1D1F]">Résultats 🧠</h2>
        <p className="text-sm text-[#8E8E93] font-medium">{title}</p>
      </div>

      <div className="px-6 flex flex-col gap-4">

        {/* Score card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 animate-slide-up">
          <div className={`w-20 h-20 ${s.bg} rounded-full flex flex-col items-center justify-center text-white font-black shadow-md flex-shrink-0`}>
            <span className="text-2xl leading-none">{result.score}</span>
            <span className="text-[10px] font-bold opacity-80">/20</span>
          </div>
          <div className="flex-1">
            <p className="font-black text-lg text-[#1D1D1F]">{s.label}</p>
            <p className="text-sm text-[#8E8E93] font-medium">{correct} bonne{correct > 1 ? 's' : ''} réponse{correct > 1 ? 's' : ''} sur {total}</p>
            <div className="mt-2 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${s.bg} rounded-full transition-all duration-700`}
                style={{ width: `${Math.round((result.score / 20) * 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Global feedback */}
        {result.globalFeedback && (
          <div className={`rounded-2xl border p-4 ${s.banner} animate-slide-up`} style={{ animationDelay: '80ms' }}>
            <p className={`text-sm font-semibold ${s.text} leading-snug`}>{result.globalFeedback}</p>
          </div>
        )}

        {/* Per-question results */}
        <div className="flex flex-col gap-3">
          {questions.map((q, idx) => {
            const r = result.results.find(res => res.id === q.id)
            const isCorrect = r?.correct ?? false
            const studentAnswer = (answers[q.id] ?? '').trim() || '(pas de réponse)'

            return (
              <div key={q.id}
                className={`bg-white rounded-3xl border shadow-sm overflow-hidden animate-slide-up`}
                style={{ animationDelay: `${(idx + 2) * 80}ms`, borderColor: isCorrect ? '#bbf7d0' : '#fed7aa' }}>
                <div className={`px-4 pt-3 pb-2 flex items-start gap-2 ${isCorrect ? 'bg-green-50' : 'bg-orange-50'}`}>
                  <span className="text-lg flex-shrink-0 mt-0.5">{isCorrect ? '✅' : '❌'}</span>
                  <p className="text-sm font-bold text-[#1D1D1F] flex-1 leading-snug">{q.question}</p>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Ta réponse</span>
                    <p className={`text-sm font-semibold mt-0.5 ${isCorrect ? 'text-green-700' : 'text-orange-700'}`}>
                      {studentAnswer}
                    </p>
                  </div>
                  {!isCorrect && r?.feedback && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">Explication</span>
                      <p className="text-sm text-blue-800 font-medium mt-0.5 leading-snug">{r.feedback}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Encouragement */}
        {result.encouragement && (
          <div className="rounded-3xl p-5 shadow-lg shadow-primary-200/50 animate-slide-up"
            style={{ animationDelay: `${(questions.length + 3) * 80}ms`, background: 'linear-gradient(135deg, #4F7CFF 0%, #7299FF 100%)' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🌟</div>
              <p className="text-white/90 text-sm font-medium leading-snug flex-1">{result.encouragement}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2 mb-4">
          <button onClick={onRetry}
            className="w-full text-white font-black text-lg py-4 rounded-2xl shadow-lg btn-press flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #4F7CFF 0%, #7299FF 100%)' }}>
            <span>🔄</span><span>Réessayer cette leçon</span>
          </button>
          <button onClick={onNew}
            className="w-full bg-white text-[#8E8E93] font-bold text-base py-3.5 rounded-2xl border border-gray-100 shadow-sm btn-press flex items-center justify-center gap-2">
            <span>📸</span><span>Nouvelle leçon</span>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RevisePage() {
  const [step, setStep] = useState<Step>('home')
  const [imageData, setImageData] = useState('')
  const [subject, setSubject] = useState('Général')
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [error, setError] = useState('')
  const [showPaywall, setShowPaywall] = useState(false)
  // Niveau scolaire de l'enfant actif — variable pédagogique centrale
  const [childLevel, setChildLevel] = useState<string>('CM1')

  useEffect(() => {
    const child = getOrCreateActiveChild()
    setChildLevel(child.level ?? 'CM1')
  }, [])

  const handleCapture = useCallback((_file: File, dataUrl: string) => {
    setImageData(dataUrl)
    setError('')
    setStep('subject')
  }, [])

  const handleSubjectSelect = useCallback(async (selectedSubject: string) => {
    // ── Freemium quota check ──────────────────────────────────────────────────
    const quota = canQuiz()
    if (!quota.allowed) {
      setShowPaywall(true)
      return
    }

    setSubject(selectedSubject)
    setStep('loading-questions')

    try {
      const resized = await resizeImage(imageData)
      const formData = new FormData()
      formData.append('image', resized, 'lesson.jpg')
      formData.append('subject', selectedSubject)
      formData.append('level', childLevel)

      const res = await fetch('/api/generate-questions', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      // Best-effort cost tracking
      try { if (data._usage) saveUsage(data._usage as UsageMeta) } catch { /* silent */ }

      setTitle(data.title ?? 'Ma leçon')
      setQuestions(data.questions ?? [])
      setStep('quiz')
    } catch {
      setError("Je n'arrive pas à lire la leçon. Reprends la photo.")
      setStep('home')
    }
  }, [imageData, childLevel])

  const handleSubmit = useCallback(async (submittedAnswers: Record<number, string>) => {
    setAnswers(submittedAnswers)
    setStep('loading-check')

    try {
      const res = await fetch('/api/check-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, questions, answers: submittedAnswers, level: childLevel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      // Best-effort cost tracking
      try { if (data._usage) saveUsage(data._usage as UsageMeta) } catch { /* silent */ }

      setResult(data as QuizResult)
      setStep('results')
    } catch {
      setError('Impossible de corriger. Réessaie !')
      setStep('quiz')
    }
  }, [title, questions, childLevel])

  const handleRetry = useCallback(() => {
    setAnswers({})
    setResult(null)
    setStep('quiz')
  }, [])

  const handleNew = useCallback(() => {
    setStep('home')
    setImageData('')
    setSubject('Général')
    setTitle('')
    setQuestions([])
    setAnswers({})
    setResult(null)
    setError('')
  }, [])

  return (
    <main className="min-h-screen bg-transparent max-w-md mx-auto relative overflow-x-hidden">
      {error && step === 'home' && (
        <div className="mx-6 mt-16 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-2">
          <span className="text-lg">😅</span>
          <p className="text-sm text-red-600 font-semibold">{error}</p>
        </div>
      )}
      {step === 'home' && <HomeScreen onCapture={handleCapture} />}
      {step === 'subject' && (
        <SubjectSelector
          onSelect={handleSubjectSelect}
          onBack={() => setStep('home')}
        />
      )}
      {step === 'loading-questions' && <LoadingScreen message={"Je prépare tes questions…"} />}
      {step === 'quiz' && (
        <QuizScreen
          title={title}
          imagePreview={imageData}
          questions={questions}
          onSubmit={handleSubmit}
          onBack={handleNew}
        />
      )}
      {step === 'loading-check' && <LoadingScreen message={"Je corrige tes réponses…"} />}
      {step === 'results' && result && (
        <ResultsScreen
          title={title}
          result={result}
          questions={questions}
          answers={answers}
          onRetry={handleRetry}
          onNew={handleNew}
        />
      )}

      {/* Freemium paywall modal */}
      {showPaywall && (
        <PaywallModal
          type="quiz"
          onClose={() => setShowPaywall(false)}
        />
      )}
    </main>
  )
}
