import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// ── Stripe client ────────────────────────────────────────────────────────────
// STRIPE_SECRET_KEY must be set in Vercel env vars before going live.
// Without it, this route returns a 503 instead of crashing at import time.

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
}

export async function POST(request: NextRequest) {
  try {
    const { priceId } = await request.json() as { priceId?: string }

    if (!priceId) {
      return NextResponse.json({ error: 'priceId manquant' }, { status: 400 })
    }

    const stripe = getStripe()

    const origin = request.headers.get('origin') ?? 'https://professeur-lena.vercel.app'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/premium`,
      // Allow coupon codes
      allow_promotion_codes: true,
      // Collect email for customer record
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[Stripe create-checkout]', message)
    const status = message.includes('not configured') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
