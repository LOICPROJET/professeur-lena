'use client'

import { useRouter } from 'next/navigation'

interface PaywallModalProps {
  type: 'correction' | 'quiz' | 'children' | 'history'
  onClose: () => void
}

const CONTENT: Record<PaywallModalProps['type'], {
  icon: string
  title: string
  subtitle: string
  bullets: string[]
}> = {
  correction: {
    icon: '📝',
    title: 'Limite atteinte',
    subtitle: 'Tu as utilisé tes 20 corrections gratuites ce mois.',
    bullets: [
      'Corrections illimitées',
      'Quiz illimités',
      'Historique complet',
      'Rapport hebdomadaire PDF',
    ],
  },
  quiz: {
    icon: '🧠',
    title: 'Limite quiz atteinte',
    subtitle: 'Tu as utilisé tes 10 quiz gratuits ce mois.',
    bullets: [
      'Quiz illimités',
      'Corrections illimitées',
      'Accès à l\'historique complet',
      'Rapport hebdomadaire PDF',
    ],
  },
  children: {
    icon: '👨‍👩‍👧',
    title: '2ème enfant',
    subtitle: 'Le plan gratuit inclut 1 enfant.',
    bullets: [
      '3 profils enfants (Premium)',
      '5 profils enfants (Famille)',
      'Historique séparé par enfant',
      'Rapports individuels',
    ],
  },
  history: {
    icon: '📚',
    title: 'Historique complet',
    subtitle: 'Le plan gratuit conserve 30 jours d\'historique.',
    bullets: [
      'Historique illimité',
      'Tous vos trimestres accessibles',
      'Suivi sur toute l\'année scolaire',
      'Export PDF disponible',
    ],
  },
}

export default function PaywallModal({ type, onClose }: PaywallModalProps) {
  const router = useRouter()
  const c = CONTENT[type]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center pb-6 px-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">

        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">{c.icon}</div>
          <h3 className="font-black text-xl text-[#1D1D1F] mb-1">{c.title}</h3>
          <p className="text-sm text-gray-500 leading-snug">{c.subtitle}</p>
        </div>

        {/* Benefits */}
        <div className="bg-primary-50 rounded-2xl p-4 mb-5">
          <p className="text-xs font-black text-primary-600 mb-3 uppercase tracking-wide">
            ⭐ Avec Premium
          </p>
          <div className="flex flex-col gap-2">
            {c.bullets.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-primary-500 font-black text-sm">✓</span>
                <span className="text-sm font-semibold text-[#1D1D1F]">{b}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-primary-100 text-center">
            <span className="text-xl font-black text-primary-600">4,99€</span>
            <span className="text-xs text-primary-500 font-medium">/mois</span>
            <span className="text-xs text-gray-400 ml-2">· ou 39,99€/an</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => { onClose(); router.push('/premium') }}
          className="w-full py-3.5 rounded-2xl text-white font-black text-base btn-press mb-3"
          style={{ background: 'linear-gradient(135deg, #4F7CFF 0%, #7299FF 100%)' }}
        >
          ⭐ Passer Premium
        </button>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-gray-100 text-gray-500 font-bold text-sm btn-press"
        >
          Pas maintenant
        </button>
      </div>
    </div>
  )
}
