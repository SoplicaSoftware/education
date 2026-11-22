import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Deck } from '../types'
import { deleteDeck, getAllDecks, putDeck } from './db'
import { uid } from './utils'

interface DecksContextValue {
  decks: Deck[] | null
  error: string | null
  saveDeck: (deck: Deck) => Promise<void>
  removeDeck: (id: string) => Promise<void>
  importDecks: (decks: Deck[]) => Promise<Deck[]>
}

const DecksContext = createContext<DecksContextValue | null>(null)

const byUpdated = (a: Deck, b: Deck) => b.updatedAt - a.updatedAt

export function DecksProvider({ children }: { children: ReactNode }) {
  const [decks, setDecks] = useState<Deck[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAllDecks()
      .then((all) => setDecks(all.sort(byUpdated)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Nie udało się wczytać zestawów.'))
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  const saveDeck = useCallback(async (deck: Deck) => {
    const updated = { ...deck, updatedAt: Date.now() }
    setDecks((prev) => [updated, ...(prev ?? []).filter((d) => d.id !== deck.id)])
    await putDeck(updated)
  }, [])

  const removeDeck = useCallback(async (id: string) => {
    setDecks((prev) => (prev ?? []).filter((d) => d.id !== id))
    await deleteDeck(id)
  }, [])

  const importDecks = useCallback(
    async (incoming: Deck[]) => {
      const existing = new Set((decks ?? []).map((d) => d.id))
      const prepared = incoming.map((d) =>
        existing.has(d.id) ? { ...d, id: uid(), title: `${d.title} (kopia)` } : d,
      )
      for (const deck of prepared) await putDeck(deck)
      setDecks((prev) => [...prepared, ...(prev ?? [])].sort(byUpdated))
      return prepared
    },
    [decks],
  )

  const value = useMemo(
    () => ({ decks, error, saveDeck, removeDeck, importDecks }),
    [decks, error, saveDeck, removeDeck, importDecks],
  )
  return <DecksContext.Provider value={value}>{children}</DecksContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useDecks() {
  const ctx = useContext(DecksContext)
  if (!ctx) throw new Error('useDecks must be used inside DecksProvider')
  return ctx
}
