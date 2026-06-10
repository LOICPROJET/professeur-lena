import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/verify-pin
 * Verifies the parent PIN server-side.
 * The actual PIN never reaches the client — only a boolean result is returned.
 *
 * Body: { pin: string }
 * Response: { valid: true } | { valid: false, error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pin } = body as { pin?: string }

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'PIN manquant' },
        { status: 400 }
      )
    }

    // PARENT_CODE is a server-side env variable — never exposed to the client
    const correctPin = process.env.PARENT_CODE ?? '1234'

    if (pin === correctPin) {
      return NextResponse.json({ valid: true })
    }

    // Slight delay on wrong PIN to slow brute-force attempts
    await new Promise((r) => setTimeout(r, 400))
    return NextResponse.json(
      { valid: false, error: 'Code incorrect' },
      { status: 401 }
    )
  } catch {
    return NextResponse.json(
      { valid: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
