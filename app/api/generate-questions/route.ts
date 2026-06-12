import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { QuizQuestion } from '@/lib/types'

// ── Personas questions par niveau ─────────────────────────────────────────────
const QUESTION_PERSONA: Record<string, string> = {
  CP: `L'élève est en CP (6 ans).
RÈGLES STRICTES :
- 4 questions maximum, pas plus (l'enfant se fatigue vite).
- Chaque question = 1 seule idée, 6 mots maximum.
- Questions très concrètes : "C'est quoi un... ?", "Trouve le chiffre...", "Entoure le mot..."
- INTERDIT : questions avec "pourquoi", "explique", "compare", "définis".
- Les questions doivent pouvoir être répondues en 1 à 3 mots.
- Utilise le vocabulaire exact de la leçon visible dans la photo.`,

  CE1: `L'élève est en CE1 (7 ans).
RÈGLES :
- 4 à 5 questions.
- Questions courtes, réponses en 1-5 mots.
- Types acceptés : "Qu'est-ce que... ?", "Complète...", "Donne un exemple de..."
- Pas de "pourquoi" complexe, mais "comment" simple est accepté.
- Vocabulaire de la leçon, phrases simples.`,

  CE2: `L'élève est en CE2 (8 ans).
RÈGLES :
- 5 questions.
- Questions variées : compréhension, application, mémorisation.
- Peut inclure un "pourquoi simple" ou "donne un exemple".
- Réponses attendues en quelques mots à une phrase courte.`,

  CM1: `L'élève est en CM1 (9-10 ans).
RÈGLES :
- 5 à 6 questions variées.
- Mélange : mémorisation, compréhension, application.
- Peut demander une courte explication ou un calcul posé.
- Vocabulaire scolaire complet de la matière.`,

  CM2: `L'élève est en CM2 (10-11 ans).
RÈGLES :
- 6 à 7 questions variées, dont au moins 2 questions d'application.
- Peut demander : "Explique avec tes mots", "Justifie", "Donne un contre-exemple".
- Les questions préparent aux méthodes du collège.
- Vocabulaire précis de la matière.`,
}

function buildQuestionsPrompt(level: string): string {
  const normalised = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'].includes(level) ? level : 'CM1'
  const persona = QUESTION_PERSONA[normalised]
  return `Tu es Léna, une professeure bienveillante.
Tu regardes une photo de leçon et tu crées des questions pour que l'élève puisse vérifier qu'il l'a bien comprise.

${persona}

IMPORTANT : Réponds UNIQUEMENT avec ce JSON valide, rien d'autre :

{
  "title": "<titre court de la leçon (5 mots max)>",
  "questions": [
    { "id": 1, "question": "<question 1>" },
    { "id": 2, "question": "<question 2>" },
    { "id": 3, "question": "<question 3>" },
    { "id": 4, "question": "<question 4>" },
    { "id": 5, "question": "<question 5>" }
  ]
}`
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const subject = (formData.get('subject') as string) || 'Général'
    const level = (formData.get('level') as string) || 'CM1'

    if (!imageFile) {
      return NextResponse.json({ error: 'Aucune image reçue' }, { status: 400 })
    }

    const bytes = await imageFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildQuestionsPrompt(level) },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Matière : ${subject}. Niveau : ${level}. Voici la leçon. Génère des questions adaptées au niveau ${level} pour vérifier que l'élève l'a bien apprise.` },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
          ],
        },
      ],
    })

    const rawText = response.choices[0]?.message?.content ?? ''
    if (!rawText) return NextResponse.json({ error: 'Impossible de générer les questions.' }, { status: 500 })

    let jsonStr = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
    const start = jsonStr.indexOf('{'); const end = jsonStr.lastIndexOf('}')
    if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1)

    const data = JSON.parse(jsonStr)
    const questions: QuizQuestion[] = Array.isArray(data.questions)
      ? data.questions.map((q: { id?: number; question?: string }, i: number) => ({
          id: typeof q.id === 'number' ? q.id : i + 1,
          question: typeof q.question === 'string' ? q.question : '',
        })).filter((q: QuizQuestion) => q.question.trim())
      : []

    if (!questions.length) return NextResponse.json({ error: 'Impossible de lire la leçon.' }, { status: 500 })

    return NextResponse.json({ title: data.title ?? subject, questions })
  } catch (error) {
    console.error('generate-questions error:', error)
    return NextResponse.json({ error: 'Une erreur est survenue. Réessaie !' }, { status: 500 })
  }
}
