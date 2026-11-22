import type { Card, Deck, Side } from '../types'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export const emptySide = (): Side => ({ text: '' })

export function newCard(): Card {
  return { id: uid(), front: emptySide(), back: emptySide(), choices: [] }
}

export function newDeck(title = ''): Deck {
  const now = Date.now()
  return { id: uid(), title, description: '', cards: [newCard(), newCard()], createdAt: now, updatedAt: now }
}

export const isSideEmpty = (side: Side) => !side.text.trim() && !side.image

export const isCardEmpty = (card: Card) =>
  isSideEmpty(card.front) && isSideEmpty(card.back) && card.choices.every((c) => !c.text.trim() && !c.image)

/** Cards that can actually be studied. */
export const studyableCards = (deck: Deck) =>
  deck.cards.filter((c) => !isSideEmpty(c.front) && (!isSideEmpty(c.back) || c.choices.some((ch) => ch.correct)))

export function pluralCards(n: number): string {
  return n === 1 ? '1 card' : `${n} cards`
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(ts)
}
