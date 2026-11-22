import { Dialog } from '@base-ui/react/dialog'
import { useMemo, useState } from 'react'
import { renderRichText } from '../lib/math'
import type { Side } from '../types'

// The only inline styles in the app: without them newlines in card text and
// oversized photos would make cards unreadable before any real styling exists.
const preserveLines = { whiteSpace: 'pre-wrap' } as const
const fitImage = { maxWidth: '100%', height: 'auto' } as const

export function RichText({ text }: { text: string }) {
  const html = useMemo(() => renderRichText(text), [text])
  return <div style={preserveLines} dangerouslySetInnerHTML={{ __html: html }} />
}

export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)
  return (
    <figure>
      <img src={src} alt={alt} style={fitImage} />
      <figcaption>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
        >
          Powiększ zdjęcie
        </button>
      </figcaption>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup>
            <Dialog.Title>{alt}</Dialog.Title>
            <img src={src} alt={alt} style={fitImage} />
            <Dialog.Close>Zamknij</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </figure>
  )
}

/** Renders a card side: optional image followed by LaTeX-aware text. */
export function SideContent({ side }: { side: Side }) {
  return (
    <div>
      {side.image && <ZoomableImage src={side.image} alt={side.text || 'Zdjęcie na fiszce'} />}
      {side.text.trim() && <RichText text={side.text} />}
    </div>
  )
}
