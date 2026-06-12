'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { ScoreBadge } from '@/components/ResultCards'
import { getAllHomework, deleteHomework, getOrCreateActiveChild } from '@/lib/storage'
import { HomeworkRecord, SUBJECT_EMOJI, ChildProfile } from '@/lib/types'

// ─── Format date ──────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} jours`

  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

// ─── Detail drawer ────────────────────────────────────────────────────────────
function DetailDrawer({ record, onClose }: { record: HomeworkRecord; onClose: () => void }) {
  const emoji = SUBJECT_EMOJI[record.subject] || '✨'

  const sections = [
    { icon: '✅', label: 'Ce qui est réussi', text: record.correction.whatIsGood, color: 'text-green-700 bg-green-50 border-green-100' },
    { icon: '⚠️', label: 'Ce qui était à corriger', text: record.correction.whatToCorrect, color: 'text-amber-700 bg-amber-50 border-amber-100' },
    { icon: '📚', label: 'Explication', text: record.correction.simpleExplanation, color: 'text-blue-700 bg-blue-50 border-blue-100' },
    { icon: '💡', label: 'Astuce', text: record.correction.memoryTip, color: 'text-yellow-700 bg-yellow-50 border-yellow-100' },
  ].filter(s => s.text?.trim())

  return (
    <div className="fixed inset-0 z-40 flex flex-col max-w-md mx-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#F9FAF8] rounded-t-3xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 flex items-center gap-3 flex-shrink-0">
          <div className="text-3xl">{emoji}</div>
          <div className="flex-1">
            <h3 className="font-black text-lg text-[#1F2937]">{record.subject}</h3>
            <p className="text-xs text-[#8E8E93] font-medium">{formatDate(record.date)}</p>
          </div>
          <ScoreBadge score={record.correction.score} size="md" />
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 btn-press">✕</button>
        </div>

        {/* Image */}
        {record.imageDataUrl && (
          <div className="mx-5 mb-3 rounded-2xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={record.imageDataUrl} alt="Devoir" className="w-full object-cover max-h-44" />
          </div>
        )}

        {/* Sections */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 flex flex-col gap-3">
          {sections.map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span>{s.icon}</span>
                <span className="font-bold text-sm">{s.label}</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line">{s.text}</p>
            </div>
          ))}

          {/* Skills */}
          {record.correction.masteredSkills?.length > 0 && (
            <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
              <p className="font-bold text-sm text-green-700 mb-2">✅ Notions maîtrisées</p>
              <div className="flex flex-wrap gap-1.5">
                {record.correction.masteredSkills.map((s, i) => (
                  <span key={i} className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-green-200">{s}</span>
                ))}
              </div>
            </div>
          )}

          {record.correction.weakSkills?.length > 0 && (
            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <p className="font-bold text-sm text-orange-700 mb-2">📌 À retravailler</p>
              <div className="flex flex-wrap gap-1.5">
                {record.correction.weakSkills.map((s, i) => (
                  <span key={i} className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-orange-200">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Encouragement */}
          {record.correction.encouragement && (
            <div className="rounded-2xl p-4 text-white text-sm font-medium leading-snug"
              style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)' }}>
              🌟 {record.correction.encouragement}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── History card ─────────────────────────────────────────────────────────────
function HistoryCard({
  record, onView, onDelete,
}: {
  record: HomeworkRecord
  onView: () => void
  onDelete: () => void
}) {
  const emoji = SUBJECT_EMOJI[record.subject] || '✨'
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up">
      <div className="p-4 flex items-center gap-3">
        {/* Subject icon */}
        <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-2xl flex-shrink-0">
          {emoji}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-base text-[#1F2937]">{record.subject}</span>
          </div>
          <p className="text-xs text-[#8E8E93] font-medium">{formatDate(record.date)}</p>
          {record.correction.parentSummary && (
            <p className="text-xs text-[#8E8E93] mt-1 leading-snug line-clamp-2">
              {record.correction.parentSummary}
            </p>
          )}
        </div>

        {/* Score */}
        <ScoreBadge score={record.correction.score} size="sm" />
      </div>

      {/* Actions */}
      <div className="border-t border-gray-50 flex">
        <button
          onClick={onView}
          className="flex-1 py-2.5 text-sm font-bold text-primary-600 btn-press flex items-center justify-center gap-1.5"
        >
          <span>👁️</span><span>Revoir</span>
        </button>
        <div className="w-px bg-gray-100" />
        {confirmDelete ? (
          <>
            <button onClick={onDelete} className="flex-1 py-2.5 text-sm font-bold text-red-500 btn-press">Confirmer</button>
            <div className="w-px bg-gray-100" />
            <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 text-sm font-bold text-gray-400 btn-press">Annuler</button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="flex-1 py-2.5 text-sm font-medium text-gray-300 btn-press flex items-center justify-center gap-1">
            <span>🗑️</span><span>Supprimer</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 py-16 text-center">
      <div className="text-7xl mb-4">📚</div>
      <h3 className="text-xl font-black text-[#1F2937] mb-2">Pas encore de devoirs !</h3>
      <p className="text-[#8E8E93] font-medium text-sm mb-6 leading-snug">
        Prends ton premier devoir en photo et je vais t'aider à comprendre.
      </p>
      <Link href="/" className="bg-primary-500 text-white font-bold px-6 py-3 rounded-2xl btn-press"
        style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)' }}>
        📸 Prendre une photo
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const [records, setRecords] = useState<HomeworkRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<HomeworkRecord | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null)

  useEffect(() => {
    const child = getOrCreateActiveChild()
    setActiveChild(child)
    setRecords(getAllHomework(child.id))
    setLoaded(true)
  }, [])

  const handleDelete = (id: string) => {
    deleteHomework(id, activeChild?.id ?? null)
    setRecords((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="min-h-screen bg-[#F9FAF8] max-w-md mx-auto flex flex-col pb-20">
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-4 pb-4">
        <h2 className="text-2xl font-black text-[#1F2937]">
          {activeChild ? `${activeChild.emoji} ${activeChild.name}` : 'Mes devoirs'} 📚
        </h2>
        <p className="text-sm text-[#8E8E93] font-medium">
          {records.length > 0 ? `${records.length} devoir${records.length > 1 ? 's' : ''} corrigé${records.length > 1 ? 's' : ''}` : 'Historique vide'}
        </p>
      </div>

      {/* Content */}
      {!loaded ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-300 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="px-6 flex flex-col gap-3">
          {records.map((record) => (
            <HistoryCard
              key={record.id}
              record={record}
              onView={() => setSelectedRecord(record)}
              onDelete={() => handleDelete(record.id)}
            />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selectedRecord && (
        <DetailDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}

      <BottomNav />
    </div>
  )
}
