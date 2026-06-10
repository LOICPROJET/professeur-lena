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

BARÈME DE NOTATION (sois strict et précis) :
- 0 à 3 : toutes les réponses sont fausses ou absentes
- 4 à 7 : la majorité des réponses est incorrecte
- 8 à 12 : environ la moitié est correct
- 13 à 16 : quelques erreurs mineures
- 17 à 20 : tout est juste ou quasi-juste
Un devoir entièrement faux doit recevoir entre 0 et 3, pas plus.

IMPORTANT : Tu dois TOUJOURS répondre avec un objet JSON valide et rien d'autre.
Ne mets pas de texte avant ou après le JSON.
Ne mets pas de balises markdown (\`\`\`json).
Réponds UNIQUEMENT avec ce JSON :

{
  "score": <nombre entier entre 0 et 20>,
  "whatIsGood": "<ce que l'enfant a bien fait, avec félicitations sincères>",
  "whatToCorrect": "<les erreurs trouvées, expliquées doucement>",
  "simpleExplanation": "<explication pourquoi c'est la bonne réponse, étape par étape si besoin>",
  "memoryTip": "<un truc simple et mémorable pour ne plus se tromper>",
  "smallExercise": "<un exercice similaire très court avec la correction entre parenthèses>",
  "encouragement": "<message d'encouragement chaleureux et motivant pour Léna>",
  "masteredSkills": ["<notion 1>", "<notion 2>"],
  "weakSkills": ["<notion à retravailler 1>", "<notion à retravailler 2>"],
  "commonMistakes": ["<erreur détectée 1>", "<erreur détectée 2>"],
  "parentSummary": "<résumé factuel en 2-3 phrases pour le parent : ce que l'enfant a fait, ce qui est réussi et ce qui est à améliorer>",
  "parentAdvice": "<conseil concret et bienveillant pour que le parent puisse aider son enfant à la maison>"
}`

// ─── JSON parser with fallback ────────────────────────────────────────────────

function parseAIResponse(rawText: string): CorrectionResultV2 {
  // Strip markdown code blocks if the model added them anyway
  let jsonStr = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()

  // Extract the JSON object (find first { and last })
  const start = jsonStr.indexOf('{')
  const end = jsonStr.lastIndexOf('}')
  if (start !== -1 && end > start) {
    jsonStr = jsonStr.slice(start, end + 1)
  }

  // Parse
  const data = JSON.parse(jsonStr)

  // Normalize and sanitize each field
  const score = Math.max(0, Math.min(20, Number(data.score) || 10))

  const str = (v: unknown) => (typeof v === 'string' ? v : String(v ?? ''))
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

  return {
    score,
    whatIsGood: str(data.whatIsGood),
    whatToCorrect: str(data.whatToCorrect),
    simpleExplanation: str(data.simpleExplanation),
    memoryTip: str(data.memoryTip),
    smallExercise: str(data.smallExercise),
    encouragement: str(data.encouragement),
    masteredSkills: arr(data.masteredSkills),
    weakSkills: arr(data.weakSkills),
    commonMistakes: arr(data.commonMistakes),
    parentSummary: str(data.parentSummary),
    parentAdvice: str(data.parentAdvice),
  }
}

// ─── Fallback result when parsing fails ───────────────────────────────────────

function fallbackResult(rawText: string): CorrectionResultV2 {
  return {
    score: 10,
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
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Matière : ${subject}. Voici la photo du devoir de Léna. Corrige-le et réponds en JSON.`,
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
