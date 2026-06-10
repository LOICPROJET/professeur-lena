'use client'

import { useRef, useCallback } from 'react'

interface CameraCaptureProps {
  onCapture: (file: File, dataUrl: string) => void
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
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

  return (
    <div className="w-full pb-6">
      {/* Main camera button */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="w-full bg-primary-500 text-white font-black text-xl py-5 rounded-3xl shadow-xl shadow-primary-200/60 btn-press flex items-center justify-center gap-3 mb-4"
        style={{
          background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
        }}
      >
        <span className="text-2xl">📸</span>
        <span>Prendre une photo</span>
      </button>

      {/* Gallery option */}
      <button
        onClick={() => galleryInputRef.current?.click()}
        className="w-full bg-white text-[#8E8E93] font-bold text-base py-4 rounded-2xl border border-gray-100 shadow-sm btn-press flex items-center justify-center gap-2"
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
