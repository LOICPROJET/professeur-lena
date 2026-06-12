import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// ── Stripe webhook ────────────────────────────────────────────────────────────
// This route receives Stripe events and persists subscription state.
//
// Storage strategy (MVP — no Vercel KV yet):
//   We use a simple in-memory map as a placeholder.
//   Replace with Vercel KV / Upstash Redis for persistence across instances.
//   The /premium/success page re-fetches subscription state directly from Stripe
//   using the session_id — so the webhook is a backup, not the primary path.
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET  (from Stripe dashboard → Webhooks → Signing secret)

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
}

// Disable body parsing — Stripe needs the raw body for signature verification

// In-memory subscription store (replace with KV in production)
// Keyed by stripeCustomerId → { plan, expiresAt }
const subscriptionStore = new Map<string, { plan: string; expiresAt: string }>()

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Signature invalide'
    console.error('[Stripe webhook] Signature error:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // ── Handle relevant events ─────────────────────────────────────────────────
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      if (customerId && subscriptionId) {
        const stripe = getStripe()
        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const plan = getPlanFromSubscription(sub)
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        subscriptionStore.set(customerId, { plan, expiresAt })
        console.log(`[Stripe webhook] Activated ${plan} for customer ${customerId}`)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const plan = getPlanFromSubscription(sub)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      if (sub.status === 'active' || sub.status === 'trialing') {
        subscriptionStore.set(customerId, { plan, expiresAt })
      } else {
        // Cancelled or past_due — demote to free
        subscriptionStore.delete(customerId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      subscriptionStore.delete(customerId)
      console.log(`[Stripe webhook] Subscription cancelled for ${customerId}`)
      break
    }
  }

  return NextResponse.json({ received: true })
}

// ── Helper — map Stripe price → internal plan ─────────────────────────────────
function getPlanFromSubscription(sub: Stripe.Subscription): string {
  // Check price IDs against env vars to determine plan
  const famillePriceIds = [
    process.env.STRIPE_PRICE_FAMILLE_MONTHLY,
    process.env.STRIPE_PRICE_FAMILLE_ANNUAL,
  ].filter(Boolean)

  for (const item of sub.items.data) {
    if (famillePriceIds.includes(item.price.id)) return 'famille'
  }
  return 'premium'
}

// ── Export store for use by /premium/success ──────────────────────────────────
