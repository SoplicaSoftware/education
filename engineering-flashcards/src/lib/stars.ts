import { useCallback, useSyncExternalStore } from 'react'

// Stars live outside the deck so starring a repo deck doesn't create a local copy of it.
const KEY = 'ef:stars'
type Stars = Record<string, string[]>

const listeners = new Set<() => void>()
let cache: Stars | null = null

function read(): Stars {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Stars
  } catch {
    cache = {}
  }
  return cache
}

function write(next: Stars) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable – keep in memory only */
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    cache = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

const EMPTY: string[] = []

/** Starred card ids of one deck, plus a toggle. */
export function useStars(deckId: string) {
  const ids = useSyncExternalStore(subscribe, () => read()[deckId] ?? EMPTY)
  const toggle = useCallback(
    (cardId: string) => {
      const current = read()[deckId] ?? []
      const next = current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]
      const all = { ...read() }
      if (next.length) all[deckId] = next
      else delete all[deckId]
      write(all)
    },
    [deckId],
  )
  return { starred: ids, isStarred: (cardId: string) => ids.includes(cardId), toggle }
}

export function useStarCounts(): Stars {
  return useSyncExternalStore(subscribe, read)
}
