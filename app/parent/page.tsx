'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getAllHomework, computeStats, GlobalStats } from '@/lib/storage'
import { HomeworkRecord, SUBJECT_EMOJI } from '@/lib/types'

// PIN is verified server-side via /api/verify-pin — never exposed in this bundle
const PIN_STORAGE_KEY = 'plena-parent-unlocked'

// ─── Score color helpers ───────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 15) return { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500', badge: 'bg-green-500' }
  if (score >= 10) return { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500', badge: 'bg-amber-500' }
  return { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500', badge: 'bg-red-500' }
}

function scoreLetter(score: number) {
  if (score >= 18) return 'Excellent'
  if (score >= 15) return 'Très bien'
  if (score >= 12) return 'Bien'
  if (score >= 10) return 'Passable'
  return 'À renforcer'
}

// ─── PIN screen ───────────────────────────────────────────────────────────────
function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)

  const verifyPin = useCallback(async (candidate: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: candidate }),
      })
      const data = await res.json()
      if (data.valid) {
        try { sessionStorage.setItem(PIN_STORAGE_KEY, '1') } catch { /* ignore */ }
        onUnlock()
      } else {
        setShake(true)
        setError(true)
        setTimeout(() => { setPin(''); setShake(false) }, 700)
      }
    } catch {
      setShake(true)
      setError(true)
      setTimeout(() => { setPin(''); setShake(false) }, 700)
    } finally {
      setLoading(false)
    }
  }, [onUnlock])

  const handleKey = useCallback((digit: string) => {
    if (pin.length >= 4 || loading) return
    const next = pin + digit
    setPin(next)
    setError(false)

    if (next.length === 4) {
      verifyPin(next)
    }
  }, [pin, loading, verifyPin])

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1))
    setError(false)
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="min-h-screen bg-[#F9FAF8] max-w-md mx-auto flex flex-col items-center justify-center px-8 gap-8">
      {/* Icon */}
      <div className="w-20 h-20 rounded-3xl bg-primary-100 flex items-center justify-center text-4xl shadow-sm">
        👨‍👩‍👧
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl font-black text-[#1F2937]">Espace Parent</h1>
        <p className="text-sm text-[#8E8E93] font-medium mt-1">
          Entrez le code à 4 chiffres
        </p>
        <p className="text-xs text-[#8E8E93] mt-0.5">(Code par défaut : 1234)</p>
      </div>

      {/* PIN dots */}
      <div className={`flex gap-4 ${shake ? 'animate-bounce' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
              loading
                ? 'bg-primary-300 border-primary-300 animate-pulse'
                : i < pin.length
                  ? error ? 'bg-red-400 border-red-400' : 'bg-primary-500 border-primary-500'
                  : 'bg-white border-gray-300'
            }`}
          />
        ))}
      </div>

      {error && !loading && (
        <p className="text-sm text-red-500 font-bold -mt-4">Code incorrect !</p>
      )}
      {loading && (
        <p className="text-sm text-primary-500 font-bold -mt-4">Vérification…</p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {digits.map((d, i) => (
          d === '' ? <div key={i} /> :
          d === '⌫' ? (
            <button key={i} onClick={handleBackspace}
              className="h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-xl text-gray-500 font-bold btn-press">
              ⌫
            </button>
          ) : (
            <button key={i} onClick={() => handleKey(d)}
              className="h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-2xl font-black text-[#1F2937] btn-press">
              {d}
            </button>
          )
        ))}
      </div>

      {/* Back */}
      <Link href="/history" className="text-sm text-[#8E8E93] font-medium flex items-center gap-1">
        ← Retour à l'historique
      </Link>
    </div>
  )
}

// ─── Subject card ─────────────────────────────────────────────────────────────
function SubjectCard({ subject, count, average }: { subject: string; count: number; average: number }) {
  const c = scoreColor(average)
  const emoji = SUBJECT_EMOJI[subject] || '✨'
  const pct = Math.round((average / 20) * 100)

  return (
    <div className={`rounded-2xl ${c.bg} p-4 flex items-center gap-3`}>
      <div className="text-2xl">{emoji}</div>
      <div className="flex-1">
        <div className="flex justify-between items-baseline mb-1">
          <span className={`font-bold text-sm ${c.text}`}>{subject}</span>
          <span className={`font-black text-sm ${c.text}`}>{average}/20</span>
        </div>
        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
          <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">{count} exercice{count > 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, sub }: { icon: string; value: string | number; label: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
      <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">{icon}</div>
      <div>
        <div className="font-black text-xl text-[#1F2937]">{value}</div>
        <div className="text-xs font-semibold text-[#8E8E93]">{label}</div>
        {sub && <div className="text-xs text-[#8E8E93]">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Pill list ────────────────────────────────────────────────────────────────
function PillList({ items, color }: { items: string[]; color: 'green' | 'orange' | 'red' | 'blue' }) {
  if (!items?.length) return <p className="text-sm text-gray-400 italic">Pas encore de données</p>
  const classes: Record<string, string> = {
    green: 'bg-green-100 text-green-700 border-green-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
  }
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {items.map((item, i) => (
        <span key={i} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${classes[color]}`}>
          {item}
        </span>
      ))}
    </div>
  )
}

// ─── Section block ────────────────────────────────────────────────────────────
function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="font-black text-base text-[#1F2937]">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ records, stats, onLock }: {
  records: HomeworkRecord[]; stats: GlobalStats; onLock: () => void
}) {
  const avgColor = scoreColor(stats.globalAverage)

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#1F2937]">Suivi de Léna 👨‍👩‍👧</h1>
            <p className="text-sm text-[#8E8E93] font-medium">Tableau de bord parent</p>
          </div>
          <button onClick={onLock}
            className="text-xs text-gray-400 font-medium bg-gray-100 px-3 py-1.5 rounded-xl btn-press">
            🔒 Verrouiller
          </button>
        </div>
      </div>

      <div className="px-5 pt-5 flex flex-col gap-4">

        {/* Global stats row */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon="📝" value={stats.total} label="Devoirs corrigés" />
          <div className={`rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 ${avgColor.bg}`}>
            <div className={`w-12 h-12 ${avgColor.badge} rounded-2xl flex items-center justify-center flex-shrink-0`}>
              <div className="text-center">
                <div className="font-black text-lg text-white leading-none">{stats.globalAverage}</div>
                <div className="text-[9px] text-white/80 font-bold">/20</div>
              </div>
            </div>
            <div>
              <div className={`font-black text-sm ${avgColor.text}`}>Moyenne</div>
              <div className="text-xs text-gray-500">{scoreLetter(stats.globalAverage)}</div>
            </div>
          </div>
        </div>

        {/* By subject */}
        {stats.bySubject.length > 0 && (
          <Section icon="📊" title="Par matière">
            <div className="flex flex-col gap-2">
              {stats.bySubject.map((s) => (
                <SubjectCard key={s.subject} subject={s.subject} count={s.count} average={s.average} />
              ))}
            </div>
          </Section>
        )}

        {/* Points forts */}
        <Section icon="💪" title="Points forts">
          <PillList items={stats.topMasteredSkills} color="green" />
          {!stats.topMasteredSkills.length && (
            <p className="text-sm text-gray-400 italic">Continuez les exercices pour voir apparaître les points forts de Léna.</p>
          )}
        </Section>

        {/* Lacunes */}
        <Section icon="📌" title="À renforcer">
          <PillList items={stats.topWeakSkills} color="orange" />
          {!stats.topWeakSkills.length && (
            <p className="text-sm text-gray-400 italic">Aucune lacune identifiée pour l'instant.</p>
          )}
        </Section>

        {/* Erreurs récurrentes */}
        {stats.topCommonMistakes.length > 0 && (
          <Section icon="🔍" title="Erreurs récurrentes">
            <PillList items={stats.topCommonMistakes} color="red" />
          </Section>
        )}

        {/* Conseils parent */}
        {stats.recentAdvice.length > 0 && (
          <Section icon="💡" title="Conseils pour aider Léna">
            <div className="flex flex-col gap-3">
              {stats.recentAdvice.map((advice, i) => (
                <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-sm text-blue-800 font-medium leading-snug">{advice}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Recent homework */}
        {records.length > 0 && (
          <Section icon="🕐" title="Derniers devoirs">
            <div className="flex flex-col gap-2">
              {records.slice(0, 5).map((r) => {
                const c = scoreColor(r.correction.score)
                const emoji = SUBJECT_EMOJI[r.subject] || '✨'
                const date = new Date(r.date)
                return (
                  <div key={r.id} className="flex items-center gap-3 py-1">
                    <span className="text-xl">{emoji}</span>
                    <div className="flex-1">
                      <span className="font-bold text-sm text-[#1F2937]">{r.subject}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <span className={`font-black text-sm ${c.text} ${c.bg} px-2.5 py-0.5 rounded-full`}>
                      {r.correction.score}/20
                    </span>
                  </div>
                )
              })}
            </div>
            <Link href="/history" className="block text-center text-xs text-primary-500 font-bold mt-3 py-2 btn-press">
              Voir tout l'historique →
            </Link>
          </Section>
        )}

        {/* Empty state */}
        {records.length === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="text-5xl mb-3">📚</div>
            <p className="font-bold text-[#1F2937] mb-1">Aucun devoir corrigé</p>
            <p className="text-sm text-[#8E8E93]">Les statistiques apparaîtront ici après les premières corrections.</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Données stockées localement · Confidentialité garantie 🔒
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ParentPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [records, setRecords] = useState<HomeworkRecord[]>([])
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Check session unlock
    try {
      if (sessionStorage.getItem(PIN_STORAGE_KEY) === '1') setUnlocked(true)
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (unlocked) {
      const all = getAllHomework()
      setRecords(all)
      setStats(computeStats(all))
    }
  }, [unlocked])

  const handleUnlock = useCallback(() => setUnlocked(true), [])

  const handleLock = useCallback(() => {
    setUnlocked(false)
    try { sessionStorage.removeItem(PIN_STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#F9FAF8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-300 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!unlocked) return <PinScreen onUnlock={handleUnlock} />

  return <Dashboard records={records} stats={stats!} onLock={handleLock} />
}
