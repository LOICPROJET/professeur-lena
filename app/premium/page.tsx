'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getUserPlan, FREE_LIMITS } from '@/lib/quotas'

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'free',
    name: 'Gratuit',
    price: '0€',
    priceSub: 'pour toujours',
    priceId: null,
    highlight: false,
    badge: null,
    features: [
      `${FREE_LIMITS.correctionsPerMonth} corrections / mois`,
      `${FREE_LIMITS.quizzesPerMonth} quiz / mois`,
      '1 profil enfant',
      `Historique ${FREE_LIMITS.historyDays} jours`,
      'Rapport hebdomadaire simplifié',
    ],
    locked: [
      'Corrections illimitées',
      'Historique complet',
      'Export PDF',
      'Email hebdomadaire',
    ],
    cta: 'Plan actuel',
    ctaDisabled: true,
  },
  {
    id: 'premium_monthly',
    name: 'Premium',
    price: '4,99€',
    priceSub: '/ mois',
    priceAlt: '39,99€/an · économisez 20%',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY,
    priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_PREMIUM,
    highlight: true,
    badge: '⭐ Le plus populaire',
    features: [
      'Corrections illimitées',
      'Quiz illimités',
      '3 profils enfants',
      'Historique complet',
      'Rapport hebdomadaire PDF',
      'Email hebdomadaire parent',
    ],
    locked: [],
    cta: 'Commencer Premium',
    ctaDisabled: false,
  },
  {
    id: 'famille',
    name: 'Famille',
    price: '7,99€',
    priceSub: '/ mois',
    priceAlt: '59,99€/an · économisez 37%',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILLE_MONTHLY,
    priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILLE_ANNUAL,
    highlight: false,
    badge: '👨‍👩‍👧 Famille',
    features: [
      "Tout ce qu'inclut Premium",
      '5 profils enfants',
      'Tableaux de bord séparés',
      'Rapports par enfant',
    ],
    locked: [],
    cta: 'Choisir Famille',
    ctaDisabled: false,
  },
] as const

// ─── Comparison table rows ────────────────────────────────────────────────────

const COMPARE_ROWS = [
  { label: 'Corrections / mois', free: '20', premium: '∞', famille: '∞' },
  { label: 'Quiz / mois',        free: '10', premium: '∞', famille: '∞' },
  { label: 'Profils enfants',    free: '1',  premium: '3', famille: '5' },
  { label: 'Historique',        free: '30j', premium: '∞', famille: '∞' },
  { label: 'Rapport PDF',       free: '—',  premium: '✓',  famille: '✓' },
  { label: 'Email parent',      free: '—',  premium: '✓',  famille: '✓' },
  { label: 'Multi-enfants',     free: '—',  premium: '—',  famille: '✓' },
] as const

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PremiumPage() {
  const router = useRouter()
  const currentPlan = getUserPlan()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleCheckout(priceId: string | undefined, planId: string) {
    if (!priceId) {
      setError('Configuration Stripe manquante. Veuillez contacter le support.')
      return
    }
    setLoading(planId)
    setError('')
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      if (data.url) window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAF8] max-w-md mx-auto pb-16">
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-4 pb-6 text-center">
        <button
          onClick={() => router.back()}
          className="absolute top-14 left-5 w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center btn-press"
        >
          <span className="text-gray-500 text-lg">←</span>
        </button>
        <div className="text-5xl mb-3">⭐</div>
        <h1 className="text-2xl font-black text-[#1F2937]">Professeur Léna Premium</h1>
        <p className="text-sm text-[#8E8E93] font-medium mt-2 leading-snug">
          Accompagnez votre enfant tout au long de l'année scolaire
        </p>
        {currentPlan !== 'free' && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-primary-50 border border-primary-200 rounded-full px-4 py-2">
            <span className="text-primary-600 font-black text-sm">⭐ Vous êtes {currentPlan === 'famille' ? 'Famille' : 'Premium'}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      )}

      {/* Plan cards */}
      <div className="px-5 flex flex-col gap-4 mb-8">
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`rounded-3xl border p-5 ${
              plan.highlight
                ? 'border-primary-300 bg-white shadow-md shadow-primary-100/50'
                : 'border-gray-100 bg-white shadow-sm'
            }`}
          >
            {/* Badge */}
            {plan.badge && (
              <div className="mb-3">
                <span className={`text-xs font-black px-3 py-1 rounded-full ${
                  plan.highlight
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {plan.badge}
                </span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-black text-[#1F2937]">{plan.price}</span>
              <span className="text-sm text-gray-400 font-medium">{plan.priceSub}</span>
            </div>
            {'priceAlt' in plan && plan.priceAlt && (
              <p className="text-xs text-gray-400 font-medium mb-3">{plan.priceAlt}</p>
            )}

            {/* Features */}
            <div className="flex flex-col gap-1.5 mb-4 mt-3">
              {plan.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-green-500 font-black text-sm flex-shrink-0">✓</span>
                  <span className="text-sm font-semibold text-[#1F2937]">{f}</span>
                </div>
              ))}
              {plan.locked.length > 0 && plan.locked.map((f, i) => (
                <div key={i} className="flex items-center gap-2 opacity-40">
                  <span className="text-gray-400 font-black text-sm flex-shrink-0">✕</span>
                  <span className="text-sm font-medium text-gray-500 line-through">{f}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            {plan.id === 'free' ? (
              <div className="w-full py-3 rounded-2xl bg-gray-50 border border-gray-100 text-center text-sm font-bold text-gray-400">
                {currentPlan === 'free' ? 'Votre plan actuel' : 'Plan de base'}
              </div>
            ) : (
              <button
                onClick={() => handleCheckout(plan.priceId ?? undefined, plan.id)}
                disabled={loading !== null || currentPlan !== 'free'}
                className="w-full py-3.5 rounded-2xl text-white font-black text-sm btn-press disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: plan.highlight
                    ? 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)'
                    : 'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)',
                }}
              >
                {loading === plan.id ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Redirection…
                  </>
                ) : currentPlan !== 'free' ? (
                  '✓ Actif'
                ) : (
                  plan.cta
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="px-5 mb-8">
        <h2 className="text-base font-black text-[#1F2937] mb-3 text-center">Comparaison détaillée</h2>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Fonctionnalité</th>
                <th className="py-3 px-3 text-center text-xs font-bold text-gray-400">Gratuit</th>
                <th className="py-3 px-3 text-center text-xs font-bold text-primary-500">Premium</th>
                <th className="py-3 px-3 text-center text-xs font-bold text-gray-500">Famille</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 px-4 text-xs font-semibold text-[#4B5563]">{row.label}</td>
                  <td className="py-2.5 px-3 text-center text-xs font-bold text-gray-400">{row.free}</td>
                  <td className="py-2.5 px-3 text-center text-xs font-black text-primary-600">{row.premium}</td>
                  <td className="py-2.5 px-3 text-center text-xs font-bold text-gray-600">{row.famille}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage existing subscription */}
      {currentPlan !== 'free' && (
        <div className="px-5 mb-4">
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/stripe/portal', { method: 'POST' })
                const data = await res.json()
                if (data.url) window.location.href = data.url
              } catch { /* silent */ }
            }}
            className="w-full py-3 rounded-2xl bg-white border border-gray-200 text-sm font-bold text-gray-600 btn-press"
          >
            ⚙️ Gérer mon abonnement
          </button>
        </div>
      )}

      {/* Footer note */}
      <div className="px-6 text-center">
        <p className="text-xs text-gray-400 leading-relaxed">
          Paiement sécurisé par Stripe. Résiliable à tout moment.
          Aucune carte requise pour le plan gratuit.
        </p>
        <Link href="/" className="text-xs font-bold text-primary-500 mt-2 inline-block">
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}
