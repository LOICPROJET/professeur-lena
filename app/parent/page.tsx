'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  getAllHomework,
  computeStats,
  computeProgressStats,
  GlobalStats,
  ProgressStats,
  getChildren,
  saveChild,
  deleteChild,
  getActiveChildId,
  setActiveChildId,
  canAddChild,
  getOrCreateActiveChild,
} from '@/lib/storage'
import {
  HomeworkRecord,
  SUBJECT_EMOJI,
  ChildProfile,
  SCHOOL_LEVELS,
  CHILD_EMOJIS,
  MAX_CHILDREN,
  IS_PREMIUM,
} from '@/lib/types'
import WeekTimeline from '@/components/WeekTimeline'

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
    if (next.length === 4) verifyPin(next)
  }, [pin, loading, verifyPin])

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1))
    setError(false)
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="min-h-screen bg-[#F9FAF8] max-w-md mx-auto flex flex-col items-center justify-center px-8 gap-8">
      <div className="w-20 h-20 rounded-3xl bg-primary-100 flex items-center justify-center text-4xl shadow-sm">
        👨‍👩‍👧
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-black text-[#1F2937]">Espace Parent</h1>
        <p className="text-sm text-[#8E8E93] font-medium mt-1">Entrez le code à 4 chiffres</p>
        <p className="text-xs text-[#8E8E93] mt-0.5">(Code par défaut : 1234)</p>
      </div>
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

// ─── Toast notification ───────────────────────────────────────────────────────
type ToastData = { type: 'success' | 'error'; message: string }

function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null
  return (
    <div
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white flex items-center gap-2 animate-fade-in ${
        toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`}
      style={{ maxWidth: 'calc(100% - 48px)', minWidth: 220 }}
    >
      <span>{toast.type === 'success' ? '✓' : '✕'}</span>
      <span>{toast.message}</span>
    </div>
  )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteModal({
  child,
  onConfirm,
  onCancel,
}: {
  child: ChildProfile
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center pb-8 px-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">{child.emoji}</div>
          <h3 className="font-black text-lg text-[#1F2937]">
            Supprimer {child.name} ?
          </h3>
          <p className="text-sm text-gray-500 mt-2 leading-snug">
            Tout l'historique et les statistiques de {child.name} seront effacés.
            Cette action est irréversible.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm btn-press"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm btn-press"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add / edit child form ────────────────────────────────────────────────────
function ChildForm({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (c: ChildProfile) => void
  onCancel: () => void
  initial?: ChildProfile
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [age, setAge] = useState(String(initial?.age ?? 8))
  const [level, setLevel] = useState(initial?.level ?? 'CM1')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '👧')

  const isEdit = Boolean(initial)

  const handleSubmit = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? `child_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      emoji,
      age: parseInt(age) || undefined,
      level: level || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    })
  }

  return (
    <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 flex flex-col gap-3">
      {isEdit && (
        <p className="text-xs font-bold text-primary-600 text-center">Modifier le profil</p>
      )}
      {/* Emoji picker */}
      <div className="flex gap-2 justify-center">
        {CHILD_EMOJIS.map(e => (
          <button key={e} onClick={() => setEmoji(e)}
            className={`w-12 h-12 rounded-2xl text-2xl flex items-center justify-center transition-all ${emoji === e ? 'bg-primary-500 shadow-md scale-110' : 'bg-white border border-gray-100'}`}>
            {e}
          </button>
        ))}
      </div>
      {/* Name */}
      <input
        type="text"
        placeholder="Prénom de l'enfant"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-[#1F2937] bg-white focus:outline-none focus:border-primary-400"
        autoFocus
      />
      {/* Age + Level */}
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Âge"
          value={age}
          min="3"
          max="18"
          onChange={e => setAge(e.target.value)}
          className="w-20 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-[#1F2937] bg-white focus:outline-none focus:border-primary-400"
        />
        <select
          value={level}
          onChange={e => setLevel(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-[#1F2937] bg-white focus:outline-none focus:border-primary-400"
        >
          {SCHOOL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="flex-1 py-2.5 rounded-xl text-white font-black text-sm btn-press disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)' }}
        >
          {isEdit ? '✓ Modifier' : '✓ Enregistrer'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-white border border-gray-100 text-gray-500 font-bold text-sm btn-press"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

// ─── Children manager ─────────────────────────────────────────────────────────
function ChildrenManager({ onRefresh }: { onRefresh?: () => void }) {
  const [children, setChildren] = useState<ChildProfile[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const reload = useCallback(() => {
    setChildren(getChildren())
    setActiveId(getActiveChildId())
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleSave = (c: ChildProfile) => {
    const isEdit = Boolean(editId)
    saveChild(c)
    const updated = getChildren()
    setChildren(updated)
    // Auto-activate first child
    if (updated.length === 1) {
      setActiveChildId(c.id)
      setActiveId(c.id)
    }
    setShowForm(false)
    setEditId(null)
    showToast('success', isEdit ? `${c.name} modifié ✓` : `${c.name} ajouté ✓`)
    onRefresh?.()
  }

  const handleActivate = (id: string) => {
    setActiveChildId(id)
    setActiveId(id)
    onRefresh?.()
  }

  const handleDeleteRequest = (id: string) => {
    if (children.length <= 1) {
      showToast('error', 'Impossible de supprimer le seul enfant.')
      return
    }
    setPendingDeleteId(id)
  }

  const handleDeleteConfirm = () => {
    if (!pendingDeleteId) return
    const child = children.find(c => c.id === pendingDeleteId)
    deleteChild(pendingDeleteId)
    setPendingDeleteId(null)
    reload()
    showToast('success', `${child?.name ?? 'Profil'} supprimé`)
    onRefresh?.()
  }

  const pendingDeleteChild = children.find(c => c.id === pendingDeleteId) ?? null
  const editChild = editId ? children.find(c => c.id === editId) : undefined
  const atLimit = !canAddChild()

  return (
    <>
      <Toast toast={toast} />
      {pendingDeleteChild && (
        <DeleteModal
          child={pendingDeleteChild}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">👨‍👩‍👧</span>
            <h3 className="font-black text-base text-[#1F2937]">Mes enfants</h3>
            {IS_PREMIUM && (
              <span className="text-[10px] font-bold text-primary-500 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded-full">
                PREMIUM
              </span>
            )}
          </div>
          {!showForm && !editId && (
            <button
              onClick={() => atLimit ? undefined : setShowForm(true)}
              disabled={atLimit}
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-lg btn-press ${
                atLimit
                  ? 'bg-gray-50 text-gray-300 cursor-default'
                  : 'bg-primary-50 text-primary-500'
              }`}
              title={atLimit ? `Limite de ${MAX_CHILDREN} enfants atteinte` : 'Ajouter un enfant'}
            >
              +
            </button>
          )}
        </div>

        {/* Premium limit info */}
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">
              {children.length} / {MAX_CHILDREN} enfant{MAX_CHILDREN > 1 ? 's' : ''}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: MAX_CHILDREN }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-1.5 rounded-full ${i < children.length ? 'bg-primary-400' : 'bg-gray-200'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Empty state */}
        {children.length === 0 && !showForm && (
          <p className="text-sm text-gray-400 italic text-center py-2">
            Aucun enfant ajouté — appuie sur + pour commencer
          </p>
        )}

        {/* Child list */}
        <div className="flex flex-col gap-2">
          {children.map(c => (
            <div key={c.id}>
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  activeId === c.id ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-100'
                }`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-[#1F2937]">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.age ? `${c.age} ans` : ''}
                    {c.age && c.level ? ' · ' : ''}
                    {c.level ?? ''}
                  </p>
                </div>

                {/* Edit button */}
                <button
                  onClick={() => { setEditId(c.id); setShowForm(false) }}
                  className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs btn-press"
                  title="Modifier"
                >
                  ✏️
                </button>

                {/* Activate / Active badge */}
                {activeId !== c.id ? (
                  <button
                    onClick={() => handleActivate(c.id)}
                    className="text-xs font-bold text-primary-500 bg-primary-50 border border-primary-200 px-2.5 py-1 rounded-lg btn-press"
                  >
                    Activer
                  </button>
                ) : (
                  <span className="text-xs font-bold text-primary-500 bg-primary-100 px-2.5 py-1 rounded-lg">
                    ✓ Actif
                  </span>
                )}

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteRequest(c.id)}
                  className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 text-xs btn-press"
                  title="Supprimer"
                >
                  🗑
                </button>
              </div>

              {/* Inline edit form */}
              {editId === c.id && (
                <div className="mt-2">
                  <ChildForm
                    initial={editChild}
                    onSave={handleSave}
                    onCancel={() => setEditId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add form */}
        {showForm && (
          <div className="mt-3">
            <ChildForm
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Limit message */}
        {atLimit && !showForm && (
          <p className="text-xs text-center text-gray-400 mt-3 italic">
            Limite de {MAX_CHILDREN} enfants atteinte
            {!IS_PREMIUM ? ' · Passez à Premium pour en ajouter plus' : ''}
          </p>
        )}
      </div>
    </>
  )
}

// ─── Progression section (parent dashboard) ───────────────────────────────────
function ProgressSection({
  progressStats,
  records,
  childName,
}: {
  progressStats: ProgressStats
  records: HomeworkRecord[]
  childName: string
}) {
  // ── Smart message ──────────────────────────────────────────────────────────
  let message = ''
  let msgCls = 'bg-blue-50 border-blue-100 text-blue-800'
  let msgIcon = 'ℹ️'

  if (progressStats.last7DaysCount === 0) {
    message = `Aucune correction cette semaine. C'est le bon moment pour reprendre doucement avec ${childName}.`
    msgCls = 'bg-gray-50 border-gray-200 text-gray-600'
    msgIcon = '💤'
  } else if (progressStats.averageTrend > 1) {
    message = `Belle progression cette semaine ! La moyenne de ${childName} a augmenté de +${progressStats.averageTrend} pts.`
    msgCls = 'bg-green-50 border-green-100 text-green-800'
    msgIcon = '🎉'
  } else if (progressStats.averageTrend < -1) {
    message = `Petite baisse cette semaine, rien d'inquiétant. ${childName} peut reprendre avec quelques exercices ciblés.`
    msgCls = 'bg-amber-50 border-amber-100 text-amber-800'
    msgIcon = '💪'
  } else if (progressStats.last7DaysCount >= 3) {
    message = `${childName} a bien travaillé cette semaine — ${progressStats.last7DaysCount} correction${progressStats.last7DaysCount > 1 ? 's' : ''}.`
    msgCls = 'bg-green-50 border-green-100 text-green-800'
    msgIcon = '✅'
  } else if (progressStats.mostWorkedSubject) {
    message = `La matière la plus travaillée est : ${progressStats.mostWorkedSubject}.`
    msgCls = 'bg-blue-50 border-blue-100 text-blue-800'
    msgIcon = '📚'
  }

  const trendPositive = progressStats.averageTrend > 0
  const hasTrend = progressStats.averageTrend !== 0

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
      <h3 className="font-black text-base text-[#1F2937]">📅 Progression de {childName}</h3>

      {/* Smart message */}
      {message && (
        <div className={`rounded-xl border px-4 py-3 flex items-start gap-2 text-sm font-medium leading-snug ${msgCls}`}>
          <span className="flex-shrink-0">{msgIcon}</span>
          <span>{message}</span>
        </div>
      )}

      {/* 7-day timeline */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
          7 derniers jours
        </p>
        <WeekTimeline records={records} showScore />
      </div>

      {/* Stats row: 7j / 30j */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-3">
          <p className="text-[11px] font-bold text-primary-600 mb-0.5">7 derniers jours</p>
          <p className="font-black text-2xl text-primary-700 leading-none">{progressStats.last7DaysCount}</p>
          <p className="text-xs text-primary-500 mt-0.5">
            {progressStats.last7DaysAverage > 0
              ? `moy. ${progressStats.last7DaysAverage}/20`
              : 'correction(s)'}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <p className="text-[11px] font-bold text-gray-500 mb-0.5">30 derniers jours</p>
          <p className="font-black text-2xl text-[#1F2937] leading-none">{progressStats.last30DaysCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {progressStats.last30DaysAverage > 0
              ? `moy. ${progressStats.last30DaysAverage}/20`
              : 'correction(s)'}
          </p>
        </div>
      </div>

      {/* Trend vs. previous week */}
      {hasTrend && (
        <div className={`flex items-center gap-3 rounded-xl p-3 border ${
          trendPositive ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
        }`}>
          <span className="text-2xl flex-shrink-0">{trendPositive ? '📈' : '📉'}</span>
          <div>
            <p className={`font-bold text-sm ${trendPositive ? 'text-green-700' : 'text-red-600'}`}>
              {trendPositive ? `+${progressStats.averageTrend}` : `${progressStats.averageTrend}`} pts cette semaine
            </p>
            <p className="text-xs text-gray-400">vs. semaine précédente</p>
          </div>
        </div>
      )}

      {/* Subject highlights */}
      {(progressStats.mostWorkedSubject || progressStats.bestSubject) && (
        <div className="grid grid-cols-2 gap-2">
          {progressStats.mostWorkedSubject && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-[11px] font-bold text-blue-600 mb-1">📚 Plus travaillé</p>
              <p className="font-black text-sm text-[#1F2937]">{progressStats.mostWorkedSubject}</p>
            </div>
          )}
          {progressStats.bestSubject && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <p className="text-[11px] font-bold text-green-600 mb-1">🏆 Point fort</p>
              <p className="font-black text-sm text-[#1F2937]">{progressStats.bestSubject}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({
  records,
  stats,
  progressStats,
  onLock,
  onRefresh,
  activeChild,
  childCount,
}: {
  records: HomeworkRecord[]
  stats: GlobalStats
  progressStats: ProgressStats
  onLock: () => void
  onRefresh: () => void
  activeChild: ChildProfile | null
  childCount: number
}) {
  const avgColor = scoreColor(stats.globalAverage)
  const childName = activeChild?.name ?? 'votre enfant'

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#1F2937]">
              Suivi de {childName} 📊
            </h1>
            <p className="text-sm text-[#8E8E93] font-medium">Tableau de bord parent</p>
          </div>
          <button
            onClick={onLock}
            className="text-xs text-gray-400 font-medium bg-gray-100 px-3 py-1.5 rounded-xl btn-press"
          >
            🔒 Verrouiller
          </button>
        </div>
      </div>

      <div className="px-5 pt-5 flex flex-col gap-4">

        {/* Active child card + family count */}
        {activeChild && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="text-3xl">{activeChild.emoji}</div>
              <div>
                <div className="font-black text-sm text-primary-700">{activeChild.name}</div>
                <div className="text-xs text-primary-500 font-medium">
                  {activeChild.level ?? 'Enfant actif'}
                </div>
              </div>
            </div>
            <StatCard
              icon="👨‍👩‍👧"
              value={childCount}
              label={childCount > 1 ? 'enfants' : 'enfant'}
              sub={`${IS_PREMIUM ? 'Premium' : 'Gratuit'} · max ${MAX_CHILDREN}`}
            />
          </div>
        )}

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

        {/* Progression section */}
        <ProgressSection
          progressStats={progressStats}
          records={records}
          childName={childName}
        />

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
            <p className="text-sm text-gray-400 italic">
              Continuez les exercices pour voir les points forts de {childName}.
            </p>
          )}
        </Section>

        {/* À renforcer */}
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
          <Section icon="💡" title={`Conseils pour aider ${childName}`}>
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
            <p className="text-sm text-[#8E8E93]">
              Les statistiques de {childName} apparaîtront ici après les premières corrections.
            </p>
          </div>
        )}

        {/* Children manager */}
        <ChildrenManager onRefresh={onRefresh} />

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
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [activeChild, setActiveChildState] = useState<ChildProfile | null>(null)
  const [childCount, setChildCount] = useState(0)

  const refreshData = useCallback(() => {
    const child = getOrCreateActiveChild()
    const all = getAllHomework(child.id)
    setActiveChildState(child)
    setChildCount(getChildren().length)
    setRecords(all)
    setStats(computeStats(all))
    setProgressStats(computeProgressStats(all))
  }, [])

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PIN_STORAGE_KEY) === '1') setUnlocked(true)
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (unlocked) refreshData()
  }, [unlocked, refreshData])

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

  if (!stats || !progressStats) return (
    <div className="min-h-screen bg-[#F9FAF8] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-300 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <Dashboard
      records={records}
      stats={stats}
      progressStats={progressStats}
      onLock={handleLock}
      onRefresh={refreshData}
      activeChild={activeChild}
      childCount={childCount}
    />
  )
}
