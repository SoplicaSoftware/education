// Study progress per deck and mode in localStorage, so a page refresh resumes where you left off.
// It holds only card ids and counters, so it stays tiny even for decks with many images.

export const progressKey = (mode: 'learn' | 'flashcards', deckId: string, starredOnly: boolean) =>
  `ef:progress:${mode}:${deckId}${starredOnly ? ':starred' : ''}`

export function loadProgress<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveProgress(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable – progress stays in memory only */
  }
}

export function clearProgress(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

/** True when the saved card ids still match the deck, i.e. the deck was not edited since. */
export const sameCards = (saved: string[] | undefined, ids: string[]) =>
  !!saved && saved.length === ids.length && saved.every((id) => ids.includes(id))
