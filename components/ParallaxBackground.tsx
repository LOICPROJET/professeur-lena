'use client'

import { useEffect, useRef } from 'react'

// ─── Fond SVG parallax Lumio ──────────────────────────────────────────────────
// 3 couches fixes (étoiles lointaines, bulles moyennes, formes proches) qui se
// décalent à des vitesses différentes au scroll. Discret, doux, ambiance maquette.
// Performance : transform via rAF, pointer-events none, désactivé si
// prefers-reduced-motion.

export default function ParallaxBackground() {
  const farRef = useRef<HTMLDivElement>(null)
  const midRef = useRef<HTMLDivElement>(null)
  const nearRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        if (farRef.current) farRef.current.style.transform = `translateY(${y * -0.04}px)`
        if (midRef.current) midRef.current.style.transform = `translateY(${y * -0.10}px)`
        if (nearRef.current) nearRef.current.style.transform = `translateY(${y * -0.18}px)`
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* Couche 1 — étoiles lointaines (lent) */}
      <div ref={farRef} className="parallax-layer" aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <g fill="#4F7CFF">
            <circle className="twinkle-a" cx="40" cy="90" r="2.5" opacity="0.3" />
            <circle className="twinkle-b" cx="340" cy="60" r="2" opacity="0.25" />
            <circle className="twinkle-c" cx="300" cy="220" r="2.5" opacity="0.3" />
            <circle className="twinkle-a" cx="70" cy="330" r="2" opacity="0.25" />
            <circle className="twinkle-b" cx="190" cy="160" r="1.8" opacity="0.2" />
            <circle className="twinkle-c" cx="350" cy="420" r="2.2" opacity="0.3" />
            <circle className="twinkle-a" cx="30" cy="540" r="2" opacity="0.25" />
            <circle className="twinkle-b" cx="240" cy="600" r="2.4" opacity="0.3" />
            <circle className="twinkle-c" cx="120" cy="720" r="2" opacity="0.25" />
            <circle className="twinkle-a" cx="330" cy="760" r="2.2" opacity="0.3" />
          </g>
          <g fill="#FF9F0A" opacity="0.5">
            <path className="twinkle-b" d="M85 200 l2.2 4.6 5 .7 -3.6 3.6 .8 5 -4.4 -2.4 -4.4 2.4 .8 -5 -3.6 -3.6 5 -.7 z" />
            <path className="twinkle-c" d="M310 320 l2 4.2 4.6 .6 -3.3 3.3 .7 4.6 -4 -2.2 -4 2.2 .7 -4.6 -3.3 -3.3 4.6 -.6 z" transform="scale(0.85)" transform-origin="310 320" />
            <path className="twinkle-a" d="M60 640 l2 4.2 4.6 .6 -3.3 3.3 .7 4.6 -4 -2.2 -4 2.2 .7 -4.6 -3.3 -3.3 4.6 -.6 z" />
          </g>
        </svg>
      </div>

      {/* Couche 2 — bulles moyennes */}
      <div ref={midRef} className="parallax-layer" aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <g className="float-a">
            <circle cx="350" cy="140" r="36" fill="#4F7CFF" opacity="0.06" />
            <circle cx="50" cy="430" r="48" fill="#A78BFA" opacity="0.07" />
          </g>
          <g className="float-b">
            <circle cx="320" cy="560" r="40" fill="#34C759" opacity="0.06" />
            <circle cx="90" cy="120" r="28" fill="#FF9F0A" opacity="0.06" />
          </g>
          <g className="float-c">
            <circle cx="200" cy="780" r="44" fill="#4F7CFF" opacity="0.05" />
          </g>
        </svg>
      </div>

      {/* Couche 3 — formes proches (rapide) */}
      <div ref={nearRef} className="parallax-layer" aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <g className="float-b" opacity="0.12">
            <path d="M30 250 q14 -22 28 0 q-14 22 -28 0 z" fill="#4F7CFF" />
          </g>
          <g className="float-a" opacity="0.12">
            <path d="M340 380 q12 -18 24 0 q-12 18 -24 0 z" fill="#A78BFA" />
          </g>
          <g className="float-c" opacity="0.1">
            <circle cx="60" cy="700" r="10" fill="#FF9F0A" />
            <circle cx="345" cy="660" r="8" fill="#34C759" />
          </g>
        </svg>
      </div>
    </>
  )
}
