import type { Card, Side } from '../types'
import { isSideEmpty, shuffle, uid } from './utils'

export type QuestionType = 'mc' | 'tf' | 'written'
export type AnswerWith = 'back' | 'front' | 'both'

export interface LearnSettings {
  types: QuestionType[]
  answerWith: AnswerWith
  roundSize: number
  shuffle: boolean
}

export const DEFAULT_SETTINGS: LearnSettings = {
  types: ['mc', 'written'],
  answerWith: 'back',
  roundSize: 7,
  shuffle: true,
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mc: 'Wybór (ABCD)',
  tf: 'Prawda / fałsz',
  written: 'Pisemne',
}

/** 0 = new, 1 = familiar (answered right once), 2 = mastered. */
export type Stage = 0 | 1 | 2

export interface Option {
  id: string
  side: Side
  correct: boolean
}

export type Question =
  | { kind: 'mc'; card: Card; prompt: Side; answer: Side; options: Option[]; multi: boolean }
  | { kind: 'tf'; card: Card; prompt: Side; answer: Side; candidate: Side; isTrue: boolean }
  | { kind: 'written'; card: Card; prompt: Side; answer: Side; accepted: string[] }
  | { kind: 'self'; card: Card; prompt: Side; answer: Side }

const sideKey = (s: Side) => `${s.text.trim().toLowerCase()}|${s.image ?? ''}`

const hasCustomChoices = (card: Card) => card.choices.length >= 2 && card.choices.some((c) => c.correct)

function correctChoicesAsSide(card: Card): Side {
  return { text: card.choices.filter((c) => c.correct).map((c) => c.text).join('\n') }
}

function pickDirection(card: Card, answerWith: AnswerWith): { prompt: Side; answer: Side } {
  const back = isSideEmpty(card.back) && hasCustomChoices(card) ? correctChoicesAsSide(card) : card.back
  // Cards with their own answer options are always asked front → back.
  const reverse =
    !hasCustomChoices(card) && !isSideEmpty(card.back) &&
    (answerWith === 'front' || (answerWith === 'both' && Math.random() < 0.5))
  return reverse ? { prompt: back, answer: card.front } : { prompt: card.front, answer: back }
}

function distractors(card: Card, answer: Side, pool: Card[], useFront: boolean, count: number): Side[] {
  const seen = new Set([sideKey(answer)])
  const result: Side[] = []
  for (const other of shuffle(pool)) {
    if (other.id === card.id) continue
    const side = useFront ? other.front : other.back
    if (isSideEmpty(side) || seen.has(sideKey(side))) continue
    seen.add(sideKey(side))
    result.push(side)
    if (result.length === count) break
  }
  return result
}

function buildMc(card: Card, pool: Card[], answerWith: AnswerWith): Question | null {
  const { prompt, answer } = pickDirection(card, answerWith)
  if (hasCustomChoices(card)) {
    const options = shuffle(card.choices).map((c) => ({
      id: c.id,
      side: { text: c.text, image: c.image },
      correct: c.correct,
    }))
    return { kind: 'mc', card, prompt, answer, options, multi: card.choices.filter((c) => c.correct).length > 1 }
  }
  const wrong = distractors(card, answer, pool, answer === card.front, 3)
  if (wrong.length === 0) return null
  const options = shuffle([
    { id: uid(), side: answer, correct: true },
    ...wrong.map((side) => ({ id: uid(), side, correct: false })),
  ])
  return { kind: 'mc', card, prompt, answer, options, multi: false }
}

function buildTf(card: Card, pool: Card[], answerWith: AnswerWith): Question | null {
  const { prompt, answer } = pickDirection(card, answerWith)
  const isTrue = Math.random() < 0.5
  if (hasCustomChoices(card)) {
    const candidates = card.choices.filter((c) => c.correct === isTrue)
    const pick = candidates[Math.floor(Math.random() * candidates.length)] ?? card.choices[0]
    return { kind: 'tf', card, prompt, answer, candidate: { text: pick.text, image: pick.image }, isTrue: pick.correct }
  }
  if (isTrue) return { kind: 'tf', card, prompt, answer, candidate: answer, isTrue: true }
  const [wrong] = distractors(card, answer, pool, answer === card.front, 1)
  if (!wrong) return null
  return { kind: 'tf', card, prompt, answer, candidate: wrong, isTrue: false }
}

function buildWritten(card: Card, answerWith: AnswerWith): Question | null {
  const { prompt, answer } = pickDirection(card, answerWith)
  const accepted = [answer.text, ...(answer === card.back ? card.choices.filter((c) => c.correct).map((c) => c.text) : [])]
    .flatMap((t) => t.split('\n'))
    .map((t) => t.trim())
    .filter(Boolean)
  if (accepted.length === 0) return null
  return { kind: 'written', card, prompt, answer, accepted }
}

export function buildQuestion(rawCard: Card, stage: Stage, pool: Card[], settings: LearnSettings): Question {
  const card = { ...rawCard, choices: rawCard.choices.filter((c) => c.text.trim() || c.image) }
  const recognition = settings.types.filter((t) => t !== 'written')
  const wantsWritten = settings.types.includes('written')
  // Recognise first (multiple choice / true-false), then recall (written).
  const preferred: QuestionType[] =
    stage === 0 && recognition.length > 0
      ? shuffle(recognition)
      : wantsWritten
        ? ['written', ...shuffle(recognition)]
        : shuffle(recognition)

  for (const type of [...preferred, ...shuffle(settings.types)]) {
    const q =
      type === 'mc'
        ? buildMc(card, pool, settings.answerWith)
        : type === 'tf'
          ? buildTf(card, pool, settings.answerWith)
          : buildWritten(card, settings.answerWith)
    if (q) return q
  }
  const { prompt, answer } = pickDirection(card, settings.answerWith)
  return { kind: 'self', card, prompt, answer }
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .replace(/[\s.,;:!?'"`()[\]{}-]+/g, ' ')
    .trim()

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

/** Returns 'exact', 'typo' (accepted with a small typo) or 'wrong'. */
export function checkWritten(input: string, accepted: string[]): 'exact' | 'typo' | 'wrong' {
  const given = normalize(input)
  if (!given) return 'wrong'
  let best = Infinity
  for (const candidate of accepted) {
    const target = normalize(candidate)
    if (given === target) return 'exact'
    if (target.length >= 6) best = Math.min(best, levenshtein(given, target))
  }
  return best <= 1 ? 'typo' : 'wrong'
}
