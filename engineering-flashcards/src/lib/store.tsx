import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Deck } from '../types'
import { deleteDeck, getAllDecks, putDeck } from './db'
import { loadRepoDecks } from './repoDecks'
import { uid } from './utils'
import { t } from './i18n'

interface DecksContextValue {
  /** Local decks plus decks from the repo's decks/ folder. A local copy overrides the repo version. */
  decks: Deck[] | null
  /** Ids of decks saved in this browser, including local edits of repo decks. */
  localIds: Set<string>
  error: string | null
  saveDeck: (deck: Deck) => Promise<void>
  removeDeck: (id: string) => Promise<void>
  importDecks: (decks: Deck[]) => Promise<Deck[]>
}

const DecksContext = createContext<DecksContextValue | null>(null)

const byUpdated = (a: Deck, b: Deck) => b.updatedAt - a.updatedAt

export function DecksProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<Deck[] | null>(null)
  const [repo, setRepo] = useState<Deck[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAllDecks()
      .then((all) => setLocal(all.sort(byUpdated)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t().errors.loadDecks))
    loadRepoDecks()
      .then(setRepo)
      .catch(() => setRepo([]))
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  const localIds = useMemo(() => new Set((local ?? []).map((d) => d.id)), [local])

  const decks = useMemo(() => {
    if (local === null || repo === null) return null
    return [...local, ...repo.filter((d) => !localIds.has(d.id))]
  }, [local, repo, localIds])

  const saveDeck = useCallback(async (deck: Deck) => {
    const updated = { ...deck, updatedAt: Date.now() }
    setLocal((prev) => [updated, ...(prev ?? []).filter((d) => d.id !== deck.id)])
    await putDeck(updated)
  }, [])

  const removeDeck = useCallback(async (id: string) => {
    setLocal((prev) => (prev ?? []).filter((d) => d.id !== id))
    await deleteDeck(id)
  }, [])

  const importDecks = useCallback(
    async (incoming: Deck[]) => {
      const existing = new Set((decks ?? []).map((d) => d.id))
      const prepared = incoming.map((d) =>
        existing.has(d.id) ? { ...d, id: uid(), title: `${d.title} (${t().errors.copy})` } : d,
      )
      for (const deck of prepared) await putDeck(deck)
      setLocal((prev) => [...prepared, ...(prev ?? [])].sort(byUpdated))
      return prepared
    },
    [decks],
  )

  const value = useMemo(
    () => ({ decks, localIds, error, saveDeck, removeDeck, importDecks }),
    [decks, localIds, error, saveDeck, removeDeck, importDecks],
  )
  return <DecksContext.Provider value={value}>{children}</DecksContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useDecks() {
  const ctx = useContext(DecksContext)
  if (!ctx) throw new Error('useDecks must be used inside DecksProvider')
  return ctx
}
