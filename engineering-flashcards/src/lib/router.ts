import { useSyncExternalStore } from 'react'

// Hash routing works on GitHub Pages without any server-side rewrites.
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const getHash = () => window.location.hash

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, getHash)
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export function navigate(path: string, { replace = false } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`
  if (replace) {
    window.history.replaceState(null, '', target)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = target
  }
  window.scrollTo({ top: 0 })
}
