import katex from 'katex'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const DELIMITERS: Array<{ open: string; close: string; display: boolean }> = [
  { open: '$$', close: '$$', display: true },
  { open: '\\[', close: '\\]', display: true },
  { open: '\\(', close: '\\)', display: false },
  { open: '$', close: '$', display: false },
]

const cache = new Map<string, string>()

/**
 * Renders text containing LaTeX: `$...$` / `\(...\)` inline, `$$...$$` / `\[...\]` display.
 * Plain text is HTML-escaped; `\$` produces a literal dollar sign.
 */
export function renderRichText(text: string): string {
  const cached = cache.get(text)
  if (cached !== undefined) return cached

  let html = ''
  let buffer = ''
  let i = 0
  outer: while (i < text.length) {
    if (text.startsWith('\\$', i)) {
      buffer += '$'
      i += 2
      continue
    }
    for (const { open, close, display } of DELIMITERS) {
      if (!text.startsWith(open, i)) continue
      const end = findClose(text, close, i + open.length)
      if (end === -1) continue
      const tex = text.slice(i + open.length, end)
      if (!tex.trim()) continue
      html += escapeHtml(buffer)
      buffer = ''
      html += katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false, output: 'html' })
      i = end + close.length
      continue outer
    }
    buffer += text[i]
    i++
  }
  html += escapeHtml(buffer)

  if (cache.size > 2000) cache.clear()
  cache.set(text, html)
  return html
}

function findClose(text: string, close: string, from: number): number {
  let idx = text.indexOf(close, from)
  // Skip escaped closers like `\$` inside inline math.
  while (idx !== -1 && close === '$' && text[idx - 1] === '\\') idx = text.indexOf(close, idx + 1)
  return idx
}

export const hasMath = (text: string) => /\$|\\\(|\\\[/.test(text)
