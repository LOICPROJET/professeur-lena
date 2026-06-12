import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { QuizResult } from '@/lib/types'
import { estimateCost, type UsageMeta } from '@/lib/openai-costs'
import { extractIdentifier, checkRateLimit, recordUsage, recordBlock, BASE_LIMITS } from '@/lib/rate-limit-redis'

const ROUTE_MODEL = 'gpt-4o' as const

// ── Personas correction quiz par niveau ───────────────────────────────────────
const CHECK_PERSONA: Record<string, string> = {
  CP: `L'élève est en CP (6 ans).
RÈGLES STRICTES :
- Si une réponse est incorrecte : feedback de 1 phrase maximum, 8 mots maximum.
- Utilise des mots très simples. Pas de jargon scolaire.
- INTERDIT dans feedback : "accord", "conjugaison", "règle de", "on appelle ça".
- Commence le feedback par une image concrète : "Ce mot s'écrit...", "Le résultat c'est...", "Pense à..."
- globalFeedback : 1 phrase courte, toujours positive même si beaucoup d'erreurs.
- encouragement : très chaleureux, empathique, "Tu vas y arriver !".`,

  CE1: `L'élève est en CE1 (7 ans).
RÈGLES :
- feedback : 1-2 phrases courtes et simples si incorrect.
- Explique l'erreur étape par étape : "D'abord... Ensuite..."
- Vocabulaire accessible : "syllabe", "chiffre", "calcul" acceptés.
- globalFeedback : positif et honnête en 1-2 phrases.
- encouragement : chaleureux et motivant.`,

  CE2: `L'élève est en CE2 (8 ans).
RÈGLES :
- feedback : 2 phrases si incorrect. Explique le "pourquoi".
- Peut citer des règles simples : "règle du pluriel", "retenue".
- Encourage l'autonomie : "Tu peux relire la leçon sur..."
- globalFeedback : bilan clair en 1-2 phrases.
- encouragement : motivant et ciblé sur les points positifs.`,

  CM1: `L'élève est en CM1 (9-10 ans).
RÈGLES :
- feedback : 2-3 phrases si incorrect. Vocabulaire grammatical complet.
- Explique le raisonnement, pas seulement la correction.
- Peut demander une reformulation mentale : "Rappelle-toi que..."
- globalFeedback : précis, nomme les notions maîtrisées et à retravailler.
- encouragement : valorise l'effort et la méthode.`,

  CM2: `L'élève est en CM2 (10-11 ans).
RÈGLES :
- feedback : précis, complet si incorrect. Vocabulaire du niveau.
- Fait le lien avec les méthodes du collège si pertinent.
- Exige la rigueur : "Il faut justifier que..."
- globalFeedback : professionnel, orienté préparation 6ème.
- encouragement : valorise le raisonnement et l'autonomie.`,
}

function buildCheckPrompt(level: string): string {
  const normalised = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'].includes(level) ? level : 'CM1'
  const persona = CHECK_PERSONA[normalised]
  return `Tu es Léna, une professeure bienveillante.
Tu vas corriger les réponses d'un élève à un quiz sur une leçon.

${persona}

Pour chaque question :
- Si la réponse est correcte (même approximative) : correct = true, feedback = ""
- Si la réponse est incorrecte ou incomplète : correct = false, feedback = explication selon les règles du niveau ci-dessus

Calcule le score /20 : 0 bonnes réponses → 0, toutes bonnes → 20, proportionnel pour le reste.

IMPORTANT : Réponds UNIQUEMENT avec ce JSON valide :

{
  "score": <entier 0-20>,
  "results": [
    { "id": <id_question>, "correct": true/false, "feedback": "<explication adaptée au niveau si faux, chaîne vide si juste>" }
  ],
  "globalFeedback": "<bilan global selon les règles du niveau>",
  "encouragement": "<message selon le niveau>"
}`
}

export async function POST(req: NextRequest) {
  try {
    // ── Rate limiting ─────────────────────────────────────────────────────────
    const identifier = extractIdentifier(req)
    const rl = await checkRateLimit(identifier, 'check-answers')
    if (!rl.allowed) {
      const cfg = BASE_LIMITS['check-answers']
      const lt  = rl.limitType ?? 'hourly'
      const lim = lt === 'daily' ? cfg.dailyLimit : cfg.hourlyLimit
      const cnt = lim - (lt === 'daily' ? rl.remaining.daily : rl.remaining.hourly)
      recordBlock(identifier, 'check-answers', lt, cnt, lim)
      return NextResponse.json(
        { error: 'rate_limit_exceeded', message: 'Tu as atteint la limite temporaire. Réessaie dans quelques minutes.' },
        { status: 429 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const body = await req.json()
    const { title, questions, answers, level } = body as {
      title: string
      questions: Array<{ id: number; question: string }>
      answers: Record<number, string>
      level?: string
    }

    if (!questions?.length) {
      return NextResponse.json({ error: 'Pas de questions reçues.' }, { status: 400 })
    }

    // Build text summary of questions + answers
    const qa = questions.map(q => {
      const answer = (answers[q.id] ?? '').trim()
      return `Q${q.id}: ${q.question}\nRéponse de l'élève: ${answer || '(pas de réponse)'}`
    }).join('\n\n')

    const userMessage = `Leçon : "${title}"\n\nVoici les questions et réponses de l'élève :\n\n${qa}\n\nCorrige chaque réponse et donne le score.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildCheckPrompt(level ?? 'CM1') },
        { role: 'user', content: userMessage },
      ],
    })

    const rawText = response.choices[0]?.message?.content ?? ''
    if (!rawText) return NextResponse.json({ error: 'Impossible de corriger les réponses.' }, { status: 500 })

    let jsonStr = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
    const start = jsonStr.indexOf('{'); const end = jsonStr.lastIndexOf('}')
    if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1)

    const data = JSON.parse(jsonStr)

    const result: QuizResult = {
      score: Math.max(0, Math.min(20, Number(data.score) || 0)),
      results: Array.isArray(data.results)
        ? data.results.map((r: { id?: number; correct?: boolean; feedback?: string }) => ({
            id: Number(r.id) || 0,
            correct: Boolean(r.correct),
            feedback: typeof r.feedback === 'string' ? r.feedback : '',
          }))
        : [],
      globalFeedback: typeof data.globalFeedback === 'string' ? data.globalFeedback : '',
      encouragement: typeof data.encouragement === 'string' ? data.encouragement : 'Continue comme ça ! 🌟',
    }

    // ── Rate limit — incrémenter après succès (no-op en mode Redis) ──────────
    await recordUsage(identifier, 'check-answers')

    // ── Usage tracking — best-effort ──────────────────────────────────────────
    const usageRaw = response.usage
    const _usage: UsageMeta | undefined = usageRaw ? {
      route: 'check-answers',
      model: ROUTE_MODEL,
      promptTokens:     usageRaw.prompt_tokens,
      completionTokens: usageRaw.completion_tokens,
      totalTokens:      usageRaw.total_tokens,
      estimatedCostUsd: estimateCost(ROUTE_MODEL, usageRaw.prompt_tokens, usageRaw.completion_tokens),
    } : undefined

    return NextResponse.json({ ...result, _usage })
  } catch (error) {
    console.error('check-answers error:', error)
    return NextResponse.json({ error: 'Une erreur est survenue. Réessaie !' }, { status: 500 })
  }
}
