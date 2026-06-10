// ─── V2 Correction result (structured JSON from OpenAI) ──────────────────────

export interface CorrectionResultV2 {
  score: number                  // /20
  whatIsGood: string             // Ce qui est réussi
  whatToCorrect: string          // Ce qui est à corriger
  simpleExplanation: string      // Explication simple
  memoryTip: string              // Astuce pour retenir
  smallExercise: string          // Petit exercice
  encouragement: string          // Message d'encouragement final
  masteredSkills: string[]       // Notions maîtrisées
  weakSkills: string[]           // Notions à retravailler
  commonMistakes: string[]       // Erreurs détectées
  parentSummary: string          // Résumé pour le parent
  parentAdvice: string           // Conseil pour le parent
}

// ─── A saved homework record ──────────────────────────────────────────────────

export interface HomeworkRecord {
  id: string                     // uuid
  date: string                   // ISO 8601
  subject: string                // Français | Maths | Anglais | Histoire | Autre
  imageDataUrl: string           // base64 thumbnail (may be empty if storage full)
  correction: CorrectionResultV2
}

// ─── Subject keys ─────────────────────────────────────────────────────────────

export type Subject = 'Français' | 'Maths' | 'Anglais' | 'Histoire' | 'Autre'

export const SUBJECTS: Subject[] = ['Français', 'Maths', 'Anglais', 'Histoire', 'Autre']

export const SUBJECT_EMOJI: Record<string, string> = {
  Français: '📖',
  Maths: '🔢',
  Anglais: '🇬🇧',
  Histoire: '🏰',
  Autre: '✨',
}
