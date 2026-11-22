/** One side of a card. `image` is a data URL (base64) so decks stay self-contained JSON. */
export interface Side {
  text: string
  image?: string
}

/** Optional author-defined answer for multiple-choice questions. */
export interface Choice {
  id: string
  text: string
  image?: string
  correct: boolean
}

export interface Card {
  id: string
  front: Side
  back: Side
  choices: Choice[]
}

export interface Deck {
  id: string
  title: string
  description: string
  cards: Card[]
  createdAt: number
  updatedAt: number
}

export interface ExportFile {
  app: 'engineering-flashcards'
  version: 1
  exportedAt: string
  decks: Deck[]
}
