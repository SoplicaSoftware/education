import { Dialog } from '@base-ui/react/dialog'
import { useMemo, useState } from 'react'
import { renderRichText } from '../lib/math'
import type { Side } from '../types'
import { Button } from './ui'
import { useT } from '../lib/i18n'

export function RichText({ text }: { text: string }) {
  const html = useMemo(() => renderRichText(text), [text])
  return <div className="RichText" dangerouslySetInnerHTML={{ __html: html }} />
}

export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)
  const m = useT()
  return (
    <>
      <button
        type="button"
        className="Zoomable"
        aria-label={m.common.enlargeImage}
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
            <Dialog.Title className="Popup-title">{m.common.image}</Dialog.Title>
            <img className="Zoomable-full" src={src} alt={alt} />
            <div className="Popup-actions">
              <Dialog.Close render={<Button />}>{m.common.close}</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

/** Renders a card side: optional image followed by LaTeX-aware text. */
export function SideContent({ side }: { side: Side }) {
  const m = useT()
  return (
    <div className="SideContent">
      {side.image && <ZoomableImage src={side.image} alt={side.text || m.common.cardImage} />}
      {side.text.trim() && <RichText text={side.text} />}
    </div>
  )
}
