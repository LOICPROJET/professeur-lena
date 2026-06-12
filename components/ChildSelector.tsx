'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChildProfile } from '@/lib/types'
import { getMaxChildren } from '@/lib/quotas'

interface ChildSelectorProps {
  children: ChildProfile[]
  activeId: string | null
  canAdd: boolean
  onSelect: (child: ChildProfile) => void
  onAdd: () => void
  onClose: () => void
}

export default function ChildSelector({
  children,
  activeId,
  canAdd,
  onSelect,
  onAdd,
  onClose,
}: ChildSelectorProps) {
  const router = useRouter()
  const maxChildren = getMaxChildren()

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between">
          <h2 className="font-black text-lg text-[#1D1D1F]">Changer d'enfant</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-bold btn-press"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Children grid */}
        <div className="px-5 pb-4">
          {children.length === 0 ? (
            <p className="text-center text-sm text-gray-400 italic py-4">
              Aucun enfant ajouté pour l'instant
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {children.map((child) => {
                const isActive = child.id === activeId
                return (
                  <button
                    key={child.id}
                    onClick={() => { onSelect(child); onClose() }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all btn-press border-2 ${
                      isActive
                        ? 'bg-primary-50 border-primary-400'
                        : 'bg-gray-50 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                          isActive ? 'bg-primary-100' : 'bg-white border border-gray-100'
                        }`}
                      >
                        {child.emoji}
                      </div>
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center shadow-sm">
                          <span className="text-white text-[10px] font-black">✓</span>
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <span
                      className={`text-xs font-black truncate w-full text-center ${
                        isActive ? 'text-primary-700' : 'text-[#1D1D1F]'
                      }`}
                    >
                      {child.name}
                    </span>

                    {/* Level badge */}
                    {child.level && (
                      <span className="text-[10px] text-gray-400 font-medium">
                        {child.level}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Add child button */}
        <div className="px-5 pb-5">
          {canAdd ? (
            <button
              onClick={() => { onAdd(); onClose() }}
              className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm bg-primary-500 text-white shadow-md shadow-primary-200 btn-press"
            >
              <span>➕</span>
              <span>Ajouter un enfant</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => { onClose(); router.push('/premium') }}
                className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm bg-primary-50 border border-primary-200 text-primary-600 btn-press"
              >
                <span>🔒</span>
                <span>Limite {maxChildren} enfant{maxChildren > 1 ? 's' : ''} — Passer Premium</span>
              </button>
              <p className="text-center text-[11px] text-gray-400 mt-2">
                Premium : 3 enfants · Famille : 5 enfants
              </p>
            </>
          )}
        </div>

        {/* iOS safe area */}
        <div className="h-4" />
      </div>
    </div>
  )
}
