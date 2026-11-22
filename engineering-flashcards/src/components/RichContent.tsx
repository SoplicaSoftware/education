import { Dialog } from '@base-ui/react/dialog'
import { useMemo, useState } from 'react'
import { renderRichText } from '../lib/math'
import type { Side } from '../types'
import { Button } from './ui'

export function RichText({ text }: { text: string }) {
  const html = useMemo(() => renderRichText(text), [text])
  return <div className="RichText" dangerouslySetInnerHTML={{ __html: html }} />
}

export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="Zoomable"
        aria-label="Enlarge image"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <img src={src} alt={alt} />
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="Backdrop" />
          <Dialog.Popup className="Popup" data-size="lg" onClick={(e) => e.stopPropagation()}>
            <Dialog.Title className="Popup-title">Image</Dialog.Title>
            <img className="Zoomable-full" src={src} alt={alt} />
            <div className="Popup-actions">
              <Dialog.Close render={<Button />}>Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

/** Renders a card side: optional image followed by LaTeX-aware text. */
export function SideContent({ side }: { side: Side }) {
  return (
    <div className="SideContent">
      {side.image && <ZoomableImage src={side.image} alt={side.text || 'Card image'} />}
      {side.text.trim() && <RichText text={side.text} />}
    </div>
  )
}
