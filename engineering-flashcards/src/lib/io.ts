import type { Card, Choice, Deck, ExportFile, Side } from '../types'
import { uid } from './utils'
import { t } from './i18n'

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const image = (v: unknown) => (typeof v === 'string' && v.startsWith('data:image/') ? v : undefined)

function toSide(v: unknown): Side {
  if (typeof v === 'string') return { text: v }
  if (!isObject(v)) return { text: '' }
  const side: Side = { text: str(v.text) }
  const img = image(v.image)
  if (img) side.image = img
  return side
}

function toChoice(v: unknown): Choice | null {
  if (typeof v === 'string') return { id: uid(), text: v, correct: false }
  if (!isObject(v)) return null
  const choice: Choice = { id: str(v.id) || uid(), text: str(v.text), correct: Boolean(v.correct) }
  const img = image(v.image)
  if (img) choice.image = img
  return choice
}

function toCard(v: unknown, fallbackId?: string): Card | null {
  if (!isObject(v)) return null
  // Also accept the simpler { term, definition } / { question, answer } shapes.
  const front = toSide(v.front ?? v.term ?? v.question)
  const back = toSide(v.back ?? v.definition ?? v.answer)
  const choices = Array.isArray(v.choices) ? v.choices.map(toChoice).filter((c): c is Choice => c !== null) : []
  return { id: str(v.id) || fallbackId || uid(), front, back, choices }
}

function toDeck(v: unknown, cardId?: (cardIndex: number) => string): Deck | null {
  if (!isObject(v) || !Array.isArray(v.cards)) return null
  const now = Date.now()
  return {
    id: str(v.id) || uid(),
    title: str(v.title) || t().errors.importedDeck,
    description: str(v.description),
    cards: v.cards.map((c, i) => toCard(c, cardId?.(i))).filter((c): c is Card => c !== null),
    createdAt: typeof v.createdAt === 'number' ? v.createdAt : now,
    updatedAt: now,
  }
}

/** Accepts an export file, a single deck, or an array of decks. */
export function parseImport(text: string): Deck[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(t().errors.invalidJson)
  }
  return parseImportData(data)
}

/** `cardId` supplies ids for cards that have none, e.g. stable ones for decks bundled from the repo. */
export function parseImportData(data: unknown, cardId?: (deckIndex: number, cardIndex: number) => string): Deck[] {
  const raw = isObject(data) && Array.isArray(data.decks) ? data.decks : Array.isArray(data) ? data : [data]
  const decks = raw
    .map((d, i) => toDeck(d, cardId && ((c) => cardId(i, c))))
    .filter((d): d is Deck => d !== null)
  if (decks.length === 0) throw new Error(t().errors.noDecks)
  return decks
}

export function buildExport(decks: Deck[]): ExportFile {
  return { app: 'engineering-flashcards', version: 1, exportedAt: new Date().toISOString(), decks }
}

function slugify(text: string) {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/Ł/g, 'L')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'flashcards'
  )
}

export function downloadDecks(decks: Deck[], name?: string) {
  const blob = new Blob([JSON.stringify(buildExport(decks), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(name ?? (decks.length === 1 ? decks[0].title : 'all-decks'))}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Parses "term<sep>definition" lines, e.g. pasted from a spreadsheet. */
export function parseBulkText(text: string, separator: string): Card[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(separator)
      const front = idx === -1 ? line : line.slice(0, idx)
      const back = idx === -1 ? '' : line.slice(idx + separator.length)
      return { id: uid(), front: { text: front.trim() }, back: { text: back.trim() }, choices: [] }
    })
}
