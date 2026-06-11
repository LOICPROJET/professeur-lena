import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { QuizQuestion } from '@/lib/types'

const SYSTEM_PROMPT = `Tu es Léna, une professeure bienveillante pour enfants de primaire et collège.
Tu regardes une photo de leçon et tu crées des questions pour vérifier que l'élève l'a bien comprise.

Génère entre 5 et 7 questions variées et adaptées au niveau :
- Questions de compréhension (Qu'est-ce que... ? Que veut dire... ?)
- Questions d'application (Calcule... / Complète... / Trouve...)
- Questions de mémorisation (Cite un exemple de... / Donne la définition de...)

Les questions doivent être claires, courtes, et permettre une réponse en quelques mots.

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

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const subject = (formData.get('subject') as string) || 'Général'

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
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Matière : ${subject}. Voici la leçon. Génère des questions pour vérifier que l'élève l'a bien apprise.` },
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
