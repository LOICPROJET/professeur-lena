'use client'

import { useRef, useCallback } from 'react'

interface CameraCaptureProps {
  onCapture: (file: File, dataUrl: string) => void
  /** 'buttons' = boutons pill (défaut) · 'circle' = gros cercle caméra façon maquette */
  variant?: 'buttons' | 'circle'
}

export default function CameraCapture({ onCapture, variant = 'buttons' }: CameraCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    (file: File) => {
      if (!file) return

      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        onCapture(file, dataUrl)
      }
      reader.readAsDataURL(file)
    },
    [onCapture]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      // Reset input so the same file can be selected again
      e.target.value = ''
    },
    [processFile]
  )

  if (variant === 'circle') {
    return (
      <div className="w-full pb-6 flex flex-col items-center">
        {/* Gros cercle caméra façon maquette */}
        <button
          onClick={() => cameraInputRef.current?.click()}
          aria-label="Prendre mon devoir en photo"
          className="relative w-44 h-44 rounded-full btn-press flex items-center justify-center"
          style={{ background: 'radial-gradient(circle at 35% 30%, #DEE8FF 0%, #F0F4FF 70%)', boxShadow: '0 12px 32px -8px rgba(79,124,255,0.35)' }}
        >
          <span className="absolute inset-3 rounded-full border-4 border-primary-200" />
          <span className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4F7CFF 0%, #7299FF 100%)' }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1l1.2-1.8A1.5 1.5 0 0 1 10 3.5h4a1.5 1.5 0 0 1 1.3.7L16.5 6h1A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z" fill="rgba(255,255,255,0.15)" />
              <circle cx="12" cy="12.5" r="3.4" />
            </svg>
          </span>
        </button>

        <button
          onClick={() => galleryInputRef.current?.click()}
          className="mt-6 bg-white text-primary-500 font-bold text-sm py-3 px-6 rounded-full border border-primary-200 shadow-card btn-press flex items-center justify-center gap-2"
        >
          <span>🖼️</span>
          <span>Choisir depuis la galerie</span>
        </button>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} aria-label="Prendre une photo avec l'appareil photo" />
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} aria-label="Choisir une photo depuis la galerie" />

        <p className="text-center text-xs text-[#4B5563] mt-4 font-medium">
          📱 Assure-toi que la photo est bien nette !
        </p>
      </div>
    )
  }

  return (
    <div className="w-full pb-6">
      {/* Main camera button */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="w-full text-white font-black text-xl py-5 rounded-full shadow-lumio btn-press flex items-center justify-center gap-3 mb-4"
        style={{
          background: 'linear-gradient(135deg, #4F7CFF 0%, #7299FF 100%)',
        }}
      >
        <span className="text-2xl">📸</span>
        <span>Prendre une photo</span>
      </button>

      {/* Gallery option */}
      <button
        onClick={() => galleryInputRef.current?.click()}
        className="w-full bg-white text-primary-500 font-bold text-base py-4 rounded-full border border-primary-200 shadow-card btn-press flex items-center justify-center gap-2"
      >
        <span>🖼️</span>
        <span>Choisir depuis la galerie</span>
      </button>

      {/* Hidden inputs */}
      {/* Camera capture (mobile) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Prendre une photo avec l'appareil photo"
      />

      {/* Gallery picker */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Choisir une photo depuis la galerie"
      />

      {/* Hint text */}
      <p className="text-center text-xs text-[#8E8E93] mt-4 font-medium">
        📱 Assure-toi que la photo est bien nette !
      </p>
    </div>
  )
}
