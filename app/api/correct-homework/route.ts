import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { CorrectionResultV2 } from '@/lib/types'

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es Léna, une professeure bienveillante pour une enfant de 10 ans niveau CM1-CM2.
Tu dois corriger les devoirs à partir d'une photo.
Tu expliques calmement, simplement et positivement.
Tu ne dois jamais humilier l'enfant.
Tu dois féliciter ce qui est réussi.
En mathématiques, montre les étapes clairement.
En français, explique les règles simplement.
Ne donne pas seulement la correction : aide l'enfant à comprendre.

IMPORTANT : Tu dois TOUJOURS répondre avec un objet JSON valide et rien d'autre.
Ne mets pas de texte avant ou après le JSON.
Ne mets pas de balises markdown (\`\`\`json).
Réponds UNIQUEMENT avec ce JSON :

{
  "scoringRationale": "<ÉTAPE OBLIGATOIRE — liste chaque réponse visible dans le devoir et indique JUSTE ou FAUX avec la correction. Exemple: '3×3=8 FAUX(correct:9), 6×3=60 FAUX(correct:18), 4×3=12 JUSTE'. Puis écris: 'X bonnes réponses sur Y total'. Puis déduis le score selon ces règles strictes: 0 bonnes→score 1-3, moins de moitié→score 4-9, environ moitié→score 10-12, majorité juste→score 13-16, tout juste→score 17-20. INTERDIT: la présentation soignée ou l'effort ne font PAS monter le score.>",
  "score": <nombre entier 0-20 strictement déduit du scoringRationale — si 0 bonnes réponses, score maximum 3>,
  "whatIsGood": "<ce que l'enfant a bien fait>",
  "whatToCorrect": "<les erreurs, expliquées doucement>",
  "simpleExplanation": "<explication de la bonne réponse, étape par étape>",
  "memoryTip": "<astuce mémorable pour ne plus se tromper>",
  "smallExercise": "<exercice similaire court avec correction entre parenthèses>",
  "encouragement": "<message chaleureux et motivant>",
  "masteredSkills": ["<notion maîtrisée 1>"],
  "weakSkills": ["<notion à retravailler 1>"],
  "commonMistakes": ["<erreur détectée 1>"],
  "parentSummary": "<résumé factuel 2-3 phrases pour le parent>",
  "parentAdvice": "<conseil concret pour aider à la maison>"
}`

// ─── Server-side score guard ──────────────────────────────────────────────────
// If the model's own rationale mentions 0 correct answers but gave a high score, cap it.

function guardScore(score: number, rationale: string, weakSkills: string[], masteredSkills: string[]): number {
  const r = rationale.toLowerCase()

  // Explicit "0 bonnes réponses" or "0 bonne" in rationale → cap at 3
  if (/\b0 bonnes? réponses?\b/.test(r) || /\b0 juste\b/.test(r)) {
    return Math.min(score, 3)
  }

  // Way more weak than mastered and high score → suspect
  if (weakSkills.length > 0 && masteredSkills.length === 0 && score > 6) {
    return Math.min(score, 6)
  }

  return score
}

// ─── JSON parser with fallback ────────────────────────────────────────────────

function parseAIResponse(rawText: string): CorrectionResultV2 {
  let jsonStr = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()

  const start = jsonStr.indexOf('{')
  const end = jsonStr.lastIndexOf('}')
  if (start !== -1 && end > start) {
    jsonStr = jsonStr.slice(start, end + 1)
  }

  const data = JSON.parse(jsonStr)

  const str = (v: unknown) => (typeof v === 'string' ? v : String(v ?? ''))
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

  const rawScore = Math.max(0, Math.min(20, Number(data.score) || 0))
  const rationale = str(data.scoringRationale)
  const masteredSkills = arr(data.masteredSkills)
  const weakSkills = arr(data.weakSkills)
  const score = guardScore(rawScore, rationale, weakSkills, masteredSkills)

  return {
    score,
    whatIsGood: str(data.whatIsGood),
    whatToCorrect: str(data.whatToCorrect),
    simpleExplanation: str(data.simpleExplanation),
    memoryTip: str(data.memoryTip),
    smallExercise: str(data.smallExercise),
    encouragement: str(data.encouragement),
    masteredSkills,
    weakSkills,
    commonMistakes: arr(data.commonMistakes),
    parentSummary: str(data.parentSummary),
    parentAdvice: str(data.parentAdvice),
  }
}

// ─── Fallback result when parsing fails ───────────────────────────────────────

function fallbackResult(rawText: string): CorrectionResultV2 {
  return {
    score: 0,
    whatIsGood: rawText.slice(0, 500) || 'Ton devoir a été analysé !',
    whatToCorrect: '',
    simpleExplanation: '',
    memoryTip: '',
    smallExercise: '',
    encouragement: 'Continue comme ça, tu fais de super progrès ! 🌟',
    masteredSkills: [],
    weakSkills: [],
    commonMistakes: [],
    parentSummary: 'Le devoir a été corrigé.',
    parentAdvice: 'Encouragez votre enfant à continuer ses efforts.',
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Clé API OpenAI manquante. Configure OPENAI_API_KEY dans .env.local' },
        { status: 500 }
      )
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const subject = (formData.get('subject') as string) || 'Général'

    if (!imageFile) {
      return NextResponse.json({ error: 'Aucune image reçue' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: "Format d'image non supporté. Utilise JPG, PNG ou WebP." },
        { status: 400 }
      )
    }

    const bytes = await imageFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Matière : ${subject}. Voici la photo du devoir. Commence par remplir scoringRationale en listant chaque réponse JUSTE ou FAUX, puis déduis le score. Réponds en JSON.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
            },
          ],
        },
      ],
    })

    const rawText = response.choices[0]?.message?.content ?? ''

    if (!rawText) {
      return NextResponse.json(
        { error: "Je n'ai pas pu analyser le devoir. Réessaie !" },
        { status: 500 }
      )
    }

    let result: CorrectionResultV2
    try {
      result = parseAIResponse(rawText)
    } catch (parseErr) {
      console.warn('JSON parse failed, using fallback:', parseErr)
      result = fallbackResult(rawText)
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('API Error:', error)

    if (error && typeof error === 'object' && 'status' in error) {
      const e = error as { status: number }
      if (e.status === 401) return NextResponse.json({ error: 'Clé API invalide.' }, { status: 401 })
      if (e.status === 429) return NextResponse.json({ error: 'Trop de demandes. Attends quelques secondes !' }, { status: 429 })
    }

    return NextResponse.json({ error: 'Une erreur est survenue. Réessaie !' }, { status: 500 })
  }
}
