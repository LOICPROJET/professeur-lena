import { NextRequest, NextResponse } from 'next/server'
import { getRateLimitStats } from '@/lib/rate-limit'

/**
 * GET /api/rate-limit-stats
 * Retourne les statistiques du rate limiter pour le dashboard admin.
 * Auth : Authorization: Bearer <ADMIN_CODE>
 */
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const pin = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const correctPin = process.env.ADMIN_CODE ?? 'lena-admin'

    if (!pin || pin !== correctPin) {
      await new Promise(r => setTimeout(r, 300))  // anti-brute-force
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    return NextResponse.json(getRateLimitStats())
  } catch (err) {
    console.error('rate-limit-stats error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
