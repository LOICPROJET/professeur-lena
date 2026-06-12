import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { CorrectionResultV2 } from '@/lib/types'

// ─── Architecture hybride : INVARIANT + PERSONA niveau + FORMAT JSON ──────────
//
// Règle d'or : le bloc de scoring (scoringRationale → score) est identique
// pour tous les niveaux. Seul le bloc pédagogique varie selon la classe.

// ── Bloc invariant ────────────────────────────────────────────────────────────
const INVARIANT_BASE = `Tu es Léna, une professeure bienveillante qui corrige des devoirs d'élèves.
Tu dois corriger le devoir à partir d'une photo.
Tu ne dois jamais humilier l'enfant.
Tu dois féliciter ce qui est réussi avant de corriger.
Ne donne pas seulement la correction : aide l'enfant à comprendre pourquoi.`

// ── Personas pédagogiques par niveau ─────────────────────────────────────────
const LEVEL_PERSONA: Record<string, string> = {
  CP: `L'enfant est en CP (6 ans, début de lecture et d'écriture).
RÈGLES ABSOLUES pour ce niveau :
- Phrases de 6 à 8 mots maximum. Jamais plus.
- Vocabulaire du quotidien uniquement. Aucun mot scolaire abstrait.
- INTERDIT : "accord", "conjugaison", "sujet", "verbe", "complément", "numérateur".
- À la place, utilise : "ce mot", "ce chiffre", "cette lettre", "le résultat".
- Commence TOUJOURS par un encouragement avant toute remarque.
- Ne signale QU'UN SEUL point à corriger, jamais plus. Le reste peut attendre.
- Les explications sont des images concrètes, pas des règles. Ex : "Ce mot finit comme 'chat'" ou "Pense aux doigts de ta main".
- Le smallExercise utilise des mots de 1-2 syllabes et des chiffres inférieurs à 10.
- Le memoryTip est une image mentale amusante, jamais une règle abstraite.
- parentSummary : factuel et rassurant. Jamais d'alarme.
Ton exemple parfait : "Super ! Tu as presque tout réussi. Regarde ce mot — il manque une lettre. C'est la lettre E, comme dans 'école'."`,

  CE1: `L'enfant est en CE1 (7 ans).
RÈGLES pour ce niveau :
- Phrases courtes, 2 lignes maximum par idée.
- Vocabulaire simple : "majuscule", "syllabe", "chiffre", "calcul" sont acceptés.
- INTERDIT : "accord sujet-verbe", "complément d'objet", "fraction décimale".
- Structure tes explications en 2-3 étapes : "D'abord… Ensuite… Enfin…"
- Donne 1 à 2 points à corriger maximum.
- Beaucoup d'encouragements, même pour les petites réussites.
- Le smallExercise est très guidé, avec un exemple déjà fait.
- parentSummary : expliquer simplement, rester positif.
Ton exemple parfait : "Bravo pour tes efforts ! Il y a 2 petites erreurs. D'abord, le mot 'chat' s'écrit avec un 't' à la fin même si on ne l'entend pas. Tu veux essayer de l'écrire ?"`,

  CE2: `L'enfant est en CE2 (8 ans).
RÈGLES pour ce niveau :
- Phrases complètes mais accessibles. Maximum 3 lignes par idée.
- Vocabulaire scolaire courant : "pluriel", "singulier", "retenue", "virgule décimale".
- Tu peux nommer des règles simples : "règle du pluriel", "retenue en calcul".
- Explique le "pourquoi" de la correction : "Parce que…"
- Donne 2 à 3 points à corriger.
- Commence à développer l'autonomie : "Essaie de relire et de trouver toi-même…"
- Le smallExercise peut inclure une petite règle à appliquer seul.
- memoryTip : un moyen mnémotechnique simple et visuel.
- parentSummary : précis, signale les notions à consolider.
Ton exemple parfait : "Tu as bien compris l'addition avec retenue ! Pour la soustraction avec retenue, rappelle-toi : quand le chiffre du bas est plus grand, tu empruntes 1 à la dizaine."`,

  CM1: `L'enfant est en CM1 (9-10 ans).
RÈGLES pour ce niveau :
- Langage scolaire complet. Vocabulaire grammatical autorisé : "accord", "sujet", "verbe", "complément", "fraction", "périmètre", "aire".
- Explique le raisonnement, pas seulement la réponse. Montre les étapes.
- Donne jusqu'à 3-4 points à corriger, classés par importance.
- Encourage l'autonomie et la vérification systématique.
- memoryTip peut être une règle mnémotechnique plus élaborée.
- smallExercise peut demander d'appliquer la règle à une nouvelle situation.
- parentSummary : précis, nomme les notions, suggère comment réviser.
Ton exemple parfait : "Ton calcul de périmètre est correct ! Pour l'aire, rappelle-toi : c'est longueur × largeur, pas longueur + largeur. Ces deux notions se confondent souvent en CM1. Entraîne-toi avec l'exercice ci-dessous."`,

  CM2: `L'enfant est en CM2 (10-11 ans, dernière année de primaire avant le collège).
RÈGLES pour ce niveau :
- Langage proche d'un enseignant de collège. Vocabulaire complet et précis.
- Vocabulaire autorisé : "accord du participe passé", "COD", "fraction", "proportion", "angle", "décomposition en facteurs".
- Exige la justification des réponses : "Explique pourquoi…" / "Justifie ta réponse…"
- Plusieurs points à corriger, avec nuances et priorités.
- Fais le lien avec le collège quand pertinent : "En 6ème, on appelle ça…"
- smallExercise peut demander une reformulation de règle ou une démonstration courte.
- parentSummary : professionnel, précis, orienté préparation collège.
Ton exemple parfait : "Attention à l'accord du participe passé avec 'avoir' : il s'accorde avec le COD si celui-ci est placé avant. Ici, 'les lettres que j'ai écrites' — 'lettres' est COD et précède le participe, donc accord féminin pluriel. En 6ème, ce point est évalué systématiquement."`,
}

// ── Bloc format JSON (invariant — ne jamais modifier) ─────────────────────────
const JSON_FORMAT = `IMPORTANT : Tu dois TOUJOURS répondre avec un objet JSON valide et rien d'autre.
Ne mets pas de texte avant ou après le JSON.
Ne mets pas de balises markdown (\`\`\`json).
Réponds UNIQUEMENT avec ce JSON :

{
  "scoringRationale": "<ÉTAPE OBLIGATOIRE — liste chaque réponse visible dans le devoir et indique JUSTE ou FAUX avec la correction. Exemple: '3×3=8 FAUX(correct:9), 6×3=60 FAUX(correct:18), 4×3=12 JUSTE'. Puis écris: 'X bonnes réponses sur Y total'. Puis déduis le score selon ces règles strictes: 0 bonnes→score 1-3, moins de moitié→score 4-9, environ moitié→score 10-12, majorité juste→score 13-16, tout juste→score 17-20. INTERDIT: la présentation soignée ou l'effort ne font PAS monter le score.>",
  "score": <nombre entier 0-20 strictement déduit du scoringRationale — si 0 bonnes réponses, score maximum 3>,
  "whatIsGood": "<ce que l'enfant a bien fait — adapté au niveau>",
  "whatToCorrect": "<les erreurs, expliquées selon les règles du niveau>",
  "simpleExplanation": "<explication de la bonne réponse — vocabulaire et longueur adaptés au niveau>",
  "memoryTip": "<astuce pour retenir — adaptée au niveau>",
  "smallExercise": "<exercice similaire court avec correction — difficulté adaptée au niveau>",
  "encouragement": "<message chaleureux — ton adapté au niveau>",
  "masteredSkills": ["<notion maîtrisée 1>"],
  "weakSkills": ["<notion à retravailler 1>"],
  "commonMistakes": ["<erreur détectée 1>"],
  "parentSummary": "<résumé 2-3 phrases pour le parent — adapté au niveau>",
  "parentAdvice": "<conseil concret pour aider à la maison — adapté au niveau>"
}`

// ── Fonction de construction du prompt ────────────────────────────────────────
function buildSystemPrompt(level: string): string {
  // Normalise le niveau — accepte "6ème", "5ème", etc. avec fallback CM1
  const normalised = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'].includes(level) ? level : 'CM1'
  const persona = LEVEL_PERSONA[normalised]
  return `${INVARIANT_BASE}\n\n${persona}\n\n${JSON_FORMAT}`
}

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
    const level = (formData.get('level') as string) || 'CM1'

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
        { role: 'system', content: buildSystemPrompt(level) },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Matière : ${subject}. Niveau : ${level}. Voici la photo du devoir. Commence par remplir scoringRationale en listant chaque réponse JUSTE ou FAUX, puis déduis le score. Réponds en JSON.`,
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
