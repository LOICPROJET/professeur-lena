import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { QuizResult } from '@/lib/types'

const SYSTEM_PROMPT = `Tu es Léna, une professeure bienveillante pour enfants de primaire et collège.
Tu vas corriger les réponses d'un élève à un quiz sur une leçon.

Pour chaque question :
- Si la réponse est correcte (même approximative) : correct = true, feedback = ""
- Si la réponse est incorrecte ou incomplète : correct = false, feedback = explication courte et douce de la bonne réponse

Calcule le score /20 : 0 bonnes réponses → 0, toutes bonnes → 20, proportionnel pour le reste.

IMPORTANT : Réponds UNIQUEMENT avec ce JSON valide :

{
  "score": <entier 0-20>,
  "results": [
    { "id": <id_question>, "correct": true/false, "feedback": "<explication si faux, chaîne vide si juste>" }
  ],
  "globalFeedback": "<bilan global en 1-2 phrases positives mais honnêtes>",
  "encouragement": "<message chaleureux et motivant pour continuer à réviser>"
}`

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const body = await req.json()
    const { title, questions, answers } = body as {
      title: string
      questions: Array<{ id: number; question: string }>
      answers: Record<number, string>
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
        { role: 'system', content: SYSTEM_PROMPT },
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

    return NextResponse.json(result)
  } catch (error) {
    console.error('check-answers error:', error)
    return NextResponse.json({ error: 'Une erreur est survenue. Réessaie !' }, { status: 500 })
  }
}
