import { useSyncExternalStore } from 'react'
import { en, pl, type Messages } from './messages'

export type Lang = 'en' | 'pl'

const MESSAGES: Record<Lang, Messages> = { en, pl }
// Shared with the hub page (same origin), so picking a language there carries over here.
const KEY = 'lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'pl') return saved
  } catch {
    /* storage unavailable */
  }
  return navigator.language.toLowerCase().startsWith('pl') ? 'pl' : 'en'
}

let lang = initialLang()
const listeners = new Set<() => void>()

function apply() {
  document.documentElement.lang = lang
  document.title = MESSAGES[lang].appTitle
}
apply()

export function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* keep in memory only */
  }
  apply()
  listeners.forEach((l) => l())
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY && (e.newValue === 'en' || e.newValue === 'pl')) setLang(e.newValue)
})

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useLang = () => useSyncExternalStore(subscribe, () => lang)

/** Messages for the current language; re-renders the component when the language changes. */
export const useT = () => MESSAGES[useLang()]

/** Messages for code outside React components (errors, toasts, new decks). */
export const t = () => MESSAGES[lang]
