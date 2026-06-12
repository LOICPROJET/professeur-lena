import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// ── Stripe Customer Portal ────────────────────────────────────────────────────
// Generates a portal session URL for the customer to manage their subscription.
// The customer ID is passed in the request body (from the JWT stored client-side).
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_PORTAL_RETURN_URL (optional — defaults to /premium)

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
}

export async function POST(request: NextRequest) {
  try {
    const { stripeCustomerId } = await request.json() as { stripeCustomerId?: string }

    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'stripeCustomerId manquant' }, { status: 400 })
    }

    const stripe = getStripe()
    const origin = request.headers.get('origin') ?? 'https://professeur-lena.vercel.app'
    const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL ?? `${origin}/premium`

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[Stripe portal]', message)
    const status = message.includes('not configured') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
