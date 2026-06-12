'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function PremiumSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      setStatus('error')
      return
    }

    async function loadSession() {
      try {
        const res = await fetch(`/api/stripe/session?session_id=${sessionId}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'Erreur activation Premium')
        }

        const tokenPayload = {
          plan: data.plan,
          expiresAt: data.expiresAt,
          stripeCustomerId: data.stripeCustomerId,
        }

        localStorage.setItem('plena-premium-token', JSON.stringify(tokenPayload))
        setStatus('success')
      } catch (error) {
        console.error('[Premium success]', error)
        setStatus('error')
      }
    }

    loadSession()
  }, [searchParams])

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white px-5 py-10">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-4xl">
          {status === 'success' ? '✅' : status === 'error' ? '⚠️' : '⏳'}
        </div>

        {status === 'loading' && (
          <>
            <h1 className="mb-3 text-2xl font-black text-gray-900">
              Activation de Premium...
            </h1>
            <p className="text-gray-600">
              Léna prépare votre abonnement.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="mb-3 text-2xl font-black text-gray-900">
              Premium activé 🎉
            </h1>
            <p className="mb-6 text-gray-600">
              Vous pouvez maintenant profiter des corrections illimitées, des rapports complets et du suivi avancé.
            </p>
            <button
              onClick={() => router.push('/')}
              className="rounded-2xl bg-primary-500 px-6 py-4 font-bold text-white shadow-lg"
            >
              Retour à Léna
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="mb-3 text-2xl font-black text-gray-900">
              Activation à vérifier
            </h1>
            <p className="mb-6 text-gray-600">
              Le paiement a peut-être réussi, mais Léna n'a pas pu activer automatiquement Premium.
            </p>
            <button
              onClick={() => router.push('/premium')}
              className="rounded-2xl bg-primary-500 px-6 py-4 font-bold text-white shadow-lg"
            >
              Retour aux offres
            </button>
          </>
        )}
      </div>
    </main>
  )
}

export default function PremiumSuccessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white px-5 py-10">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-4xl">
            ⏳
          </div>
          <h1 className="mb-3 text-2xl font-black text-gray-900">
            Chargement...
          </h1>
        </div>
      </main>
    }>
      <PremiumSuccessContent />
    </Suspense>
  )
}
