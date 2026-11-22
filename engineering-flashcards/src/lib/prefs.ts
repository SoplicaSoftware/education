import { useEffect, useState } from 'react'

/** Small UI preferences in localStorage (decks themselves live in IndexedDB). */
export function usePref<T>(key: string, initial: T): [T, (value: T) => void] {
  const storageKey = `ef:pref:${key}`
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? { ...initial, ...JSON.parse(raw) } : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      /* storage unavailable – keep in memory only */
    }
  }, [storageKey, value])
  return [value, setValue]
}
