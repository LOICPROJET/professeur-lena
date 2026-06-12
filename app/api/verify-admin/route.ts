import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/verify-admin
 * Verifies the admin PIN server-side.
 * Uses env var ADMIN_CODE (default: 'lena-admin').
 * Set ADMIN_CODE in .env.local to change the default.
 *
 * Body: { pin: string }
 * Response: { valid: true } | { valid: false, error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pin } = body as { pin?: string }

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ valid: false, error: 'Code manquant' }, { status: 400 })
    }

    const correctPin = process.env.ADMIN_CODE ?? 'lena-admin'

    if (pin === correctPin) {
      return NextResponse.json({ valid: true })
    }

    await new Promise(r => setTimeout(r, 400))
    return NextResponse.json({ valid: false, error: 'Code incorrect' }, { status: 401 })
  } catch {
    return NextResponse.json({ valid: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
