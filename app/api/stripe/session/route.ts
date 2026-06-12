import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// ── /api/stripe/session ───────────────────────────────────────────────────────
// Called by /premium/success?session_id=xxx to get subscription details.
// Returns { plan, expiresAt, stripeCustomerId } for client-side JWT storage.

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
}

function getPlan(sub: Stripe.Subscription): string {
  const famillePriceIds = [
    process.env.STRIPE_PRICE_FAMILLE_MONTHLY,
    process.env.STRIPE_PRICE_FAMILLE_ANNUAL,
  ].filter(Boolean)

  for (const item of sub.items.data) {
    if (famillePriceIds.includes(item.price.id)) return 'famille'
  }
  return 'premium'
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id manquant' }, { status: 400 })
  }

  try {
    const stripe = getStripe()

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.json({ error: 'Paiement non confirmé' }, { status: 402 })
    }

    const sub = session.subscription as Stripe.Subscription | null
    if (!sub) {
      return NextResponse.json({ error: 'Abonnement introuvable' }, { status: 404 })
    }

    const plan = getPlan(sub)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const stripeCustomerId = session.customer as string

    return NextResponse.json({ plan, expiresAt, stripeCustomerId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[Stripe session]', message)
    const status = message.includes('not configured') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
