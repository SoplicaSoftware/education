import { Collapsible } from '@base-ui/react/collapsible'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Page, Section, TopBar } from '../components/Layout'
import { RichText } from '../components/RichContent'
import {
  Button,
  Checkbox,
  ChevronRightIcon,
  CloseIcon,
  Field,
  FieldControl,
  PlusIcon,
  Segmented,
  Sheet,
  TextArea,
  TextInput,
  notify,
} from '../components/ui'
import { imageFileToDataUrl, imageFromClipboard } from '../lib/image'
import { parseBulkText } from '../lib/io'
import { hasMath } from '../lib/math'
import { navigate } from '../lib/router'
import { useDecks } from '../lib/store'
import { isCardEmpty, newCard, pluralCards, uid } from '../lib/utils'
import type { Card, Choice, Deck, Side } from '../types'
import { t, useT } from '../lib/i18n'

const letter = (i: number) => String.fromCharCode(65 + i)

export function DeckEditor({ deck: initial }: { deck: Deck }) {
  const { saveDeck, removeDeck } = useDecks()
  const m = useT()
  const [deck, setDeck] = useState(initial)
  const [status, setStatus] = useState<'saved' | 'saving'>('saved')
  const [bulkOpen, setBulkOpen] = useState(false)
  const latest = useRef(deck)
  const dirty = useRef(false)
  const edited = useRef(false)

  useEffect(() => {
    latest.current = deck
    if (!dirty.current) return
    setStatus('saving')
    const timer = setTimeout(() => {
      dirty.current = false
      saveDeck(latest.current)
        .then(() => setStatus('saved'))
        .catch(() => notify(t().editor.saveFailed, t().editor.saveFailedText, 'error'))
    }, 400)
    return () => clearTimeout(timer)
  }, [deck, saveDeck])

  // On leaving: drop blank cards and discard a deck that was never filled in.
  // Deferred so React StrictMode's simulated unmount/remount doesn't trigger it.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      setTimeout(() => {
        if (mounted.current) return
        const d = latest.current
        const cards = d.cards
          .filter((c) => !isCardEmpty(c))
          .map((c) => ({ ...c, choices: c.choices.filter((ch) => ch.text.trim() || ch.image) }))
        if (!d.title.trim() && cards.length === 0) {
          void removeDeck(d.id)
        } else if (edited.current) {
          void saveDeck({ ...d, cards })
        }
      }, 0)
    }
  }, [removeDeck, saveDeck])

  const update = useCallback((fn: (d: Deck) => Deck) => {
    dirty.current = true
    edited.current = true
    setDeck(fn)
  }, [])

  const updateCard = useCallback(
    (id: string, fn: (c: Card) => Card) => update((d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? fn(c) : c)) })),
    [update],
  )
  const removeCard = useCallback(
    (id: string) => update((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== id) })),
    [update],
  )

  const addCard = () => {
    const card = newCard()
    update((d) => ({ ...d, cards: [...d.cards, card] }))
    requestAnimationFrame(() => document.getElementById(`card-${card.id}-front`)?.focus())
  }

  return (
    <>
      <TopBar
        back={`/deck/${deck.id}`}
        title={deck.title.trim() || m.editor.newDeck}
        subtitle={status === 'saving' ? m.editor.saving : m.editor.saved}
        actions={
          <Button variant="primary" onClick={() => navigate(`/deck/${deck.id}`)}>
            {m.editor.done}
          </Button>
        }
      />
      <Page>
        <div className="Stack">
          <Field label={m.editor.title}>
            <FieldControl
              className="Input"
              value={deck.title}
              onValueChange={(title) => update((d) => ({ ...d, title }))}
              placeholder={m.editor.titlePlaceholder}
              autoFocus={!deck.title}
            />
          </Field>
          <Field label={m.editor.description}>
            <FieldControl
              render={<TextArea rows={2} />}
              value={deck.description}
              onValueChange={(description) => update((d) => ({ ...d, description }))}
              placeholder={m.editor.optional}
            />
          </Field>
          <LatexHelp />
        </div>

        <Section
          title={pluralCards(deck.cards.length)}
          actions={<Button onClick={() => setBulkOpen(true)}>{m.editor.paste}</Button>}
        >
          <ol className="Stack PlainList">
            {deck.cards.map((card, index) => (
              <CardEditor key={card.id} card={card} index={index} onChange={updateCard} onRemove={removeCard} />
            ))}
          </ol>
          <div>
            <Button variant="primary" onClick={addCard}>
              <PlusIcon /> {m.editor.addCard}
            </Button>
          </div>
        </Section>
      </Page>

      <BulkImportSheet
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onImport={(cards) => {
          update((d) => ({ ...d, cards: [...d.cards.filter((c) => !isCardEmpty(c)), ...cards] }))
          notify(m.editor.added(pluralCards(cards.length)))
        }}
      />
    </>
  )
}

const CardEditor = memo(function CardEditor({
  card,
  index,
  onChange,
  onRemove,
}: {
  card: Card
  index: number
  onChange: (id: string, fn: (c: Card) => Card) => void
  onRemove: (id: string) => void
}) {
  const m = useT()
  const setSide = (key: 'front' | 'back') => (side: Side) => onChange(card.id, (c) => ({ ...c, [key]: side }))
  const setChoices = (fn: (choices: Choice[]) => Choice[]) => onChange(card.id, (c) => ({ ...c, choices: fn(c.choices) }))

  return (
    <li className="EditorCard">
      <div className="EditorCard-header">
        <span className="EditorCard-title">{m.editor.card(index + 1)}</span>
        <Button variant="ghost" onClick={() => onRemove(card.id)} aria-label={m.editor.deleteCard(index + 1)}>
          {m.editor.delete}
        </Button>
      </div>
      <div className="EditorSides">
        <SideEditor id={`card-${card.id}-front`} label={m.editor.front} side={card.front} onChange={setSide('front')} />
        <SideEditor
          id={`card-${card.id}-back`}
          label={m.editor.back}
          side={card.back}
          onChange={setSide('back')}
          placeholder={card.choices.some((c) => c.correct) ? m.editor.backOptional : undefined}
        />
      </div>
      <Field label={m.editor.explanation} description={m.editor.explanationHint}>
        <FieldControl
          render={<TextArea rows={3} />}
          value={card.explanation ?? ''}
          onValueChange={(text) =>
            onChange(card.id, (c) => {
              const next: Card = { ...c, explanation: text }
              if (!text) delete next.explanation
              return next
            })
          }
          placeholder={m.editor.explanationPlaceholder}
        />
      </Field>
      {card.explanation && hasMath(card.explanation) && (
        <div className="Preview">
          <span className="Hint">{m.editor.preview}</span>
          <RichText text={card.explanation} />
        </div>
      )}
      <ChoicesEditor choices={card.choices} onChange={setChoices} />
    </li>
  )
})

function ImageButton({ onImage, label }: { onImage: (dataUrl: string) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null)
  const m = useT()
  return (
    <>
      <Button variant="ghost" onClick={() => input.current?.click()} aria-label={label}>
        <PlusIcon /> {m.common.image}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            onImage(await imageFileToDataUrl(file))
          } catch (err) {
            notify(t().editor.imageFailed, err instanceof Error ? err.message : undefined, 'error')
          }
        }}
      />
    </>
  )
}

function ImagePreview({ src, onRemove }: { src: string; onRemove: () => void }) {
  const m = useT()
  return (
    <figure className="ImagePreview">
      <img src={src} alt="" />
      <Button variant="ghost" size="icon" onClick={onRemove} aria-label={m.editor.removeImage}>
        <CloseIcon />
      </Button>
    </figure>
  )
}

function SideEditor({
  id,
  label,
  side,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  side: Side
  onChange: (side: Side) => void
  placeholder?: string
}) {
  const m = useT()
  const setImage = (image?: string) => {
    const next: Side = { text: side.text }
    if (image) next.image = image
    onChange(next)
  }

  return (
    <div className="Field">
      <div className="Field-label">
        <label htmlFor={id}>{label}</label>
        <ImageButton onImage={setImage} label={m.editor.addImage(label)} />
      </div>
      <TextArea
        id={id}
        value={side.text}
        rows={3}
        placeholder={placeholder ?? m.editor.textPlaceholder}
        onChange={(e) => onChange({ ...side, text: e.target.value })}
        onPaste={async (e) => {
          const file = imageFromClipboard(e)
          if (!file) return
          e.preventDefault()
          try {
            setImage(await imageFileToDataUrl(file))
          } catch (err) {
            notify(t().editor.pasteImageFailed, err instanceof Error ? err.message : undefined, 'error')
          }
        }}
      />
      {side.image && <ImagePreview src={side.image} onRemove={() => setImage(undefined)} />}
      {hasMath(side.text) && (
        <div className="Preview">
          <span className="Hint">{m.editor.preview}</span>
          <RichText text={side.text} />
        </div>
      )}
    </div>
  )
}

function ChoicesEditor({ choices, onChange }: { choices: Choice[]; onChange: (fn: (c: Choice[]) => Choice[]) => void }) {
  const [open, setOpen] = useState(choices.length > 0)
  const m = useT()
  const updateChoice = (id: string, patch: Partial<Choice>) =>
    onChange((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  return (
    <Collapsible.Root className="Collapsible-box" open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="Collapsible-trigger">
        <ChevronRightIcon className="Collapsible-icon" />
        {m.editor.choices}
        <span className="Muted">{choices.length > 0 ? `(${choices.length})` : m.editor.choicesOptional}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="Collapsible-panel">
        <div className="Collapsible-content">
          <p className="Muted">{m.editor.choicesText}</p>
          <ul className="ChoiceList">
            {choices.map((choice, i) => (
              <li key={choice.id} className="ChoiceRow">
                <Checkbox
                  checked={choice.correct}
                  onCheckedChange={(correct) => updateChoice(choice.id, { correct })}
                  aria-label={m.editor.choiceCorrect(letter(i))}
                />
                <TextInput
                  value={choice.text}
                  onValueChange={(text) => updateChoice(choice.id, { text })}
                  placeholder={m.editor.choice(letter(i))}
                />
                <ImageButton label={m.editor.choiceImage(letter(i))} onImage={(image) => updateChoice(choice.id, { image })} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={m.editor.removeChoice(letter(i))}
                  onClick={() => onChange((list) => list.filter((c) => c.id !== choice.id))}
                >
                  <CloseIcon />
                </Button>
                {(choice.image || hasMath(choice.text)) && (
                  <div className="ChoiceRow-extra">
                    {choice.image && <ImagePreview src={choice.image} onRemove={() => updateChoice(choice.id, { image: undefined })} />}
                    {hasMath(choice.text) && (
                      <div className="Preview">
                        <RichText text={choice.text} />
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div>
            <Button onClick={() => onChange((list) => [...list, { id: uid(), text: '', correct: list.length === 0 }])}>
              <PlusIcon /> {m.editor.addChoice}
            </Button>
          </div>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

function LatexHelp() {
  const m = useT()
  return (
    <Collapsible.Root className="Collapsible-box">
      <Collapsible.Trigger className="Collapsible-trigger">
        <ChevronRightIcon className="Collapsible-icon" />
        {m.editor.helpTitle}
      </Collapsible.Trigger>
      <Collapsible.Panel className="Collapsible-panel">
        <ul className="Collapsible-content HelpList">
          <li>
            {m.editor.helpInline} <code>$\sigma = E\varepsilon$</code>
          </li>
          <li>
            {m.editor.helpBlock} <code>$$\int_0^l F\,dx$$</code>
          </li>
          <li>
            {m.editor.helpDollar} <code>\$</code>
          </li>
          <li>{m.editor.helpImage}</li>
        </ul>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

const SEPARATORS = [
  { value: 'tab', label: 'sepTab', sep: '\t' },
  { value: 'semicolon', label: 'sepSemicolon', sep: ';' },
  { value: 'dash', label: 'sepDash', sep: ' - ' },
] as const
type SeparatorKey = (typeof SEPARATORS)[number]['value']

function BulkImportSheet({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (cards: Card[]) => void
}) {
  const [text, setText] = useState('')
  const m = useT()
  const [sep, setSep] = useState<SeparatorKey>('tab')
  const separator = SEPARATORS.find((s) => s.value === sep)!.sep
  const cards = parseBulkText(text, separator)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={m.editor.paste}
      description={m.editor.bulkText}
      size="lg"
      footer={
        <Button
          variant="primary"
          disabled={cards.length === 0}
          onClick={() => {
            onImport(cards)
            setText('')
            onOpenChange(false)
          }}
        >
          {m.editor.bulkAdd(cards.length > 0 ? pluralCards(cards.length) : null)}
        </Button>
      }
    >
      <Segmented
        label={m.editor.separator}
        value={[sep]}
        onChange={([v]) => setSep(v)}
        options={SEPARATORS.map((s) => ({ value: s.value, label: m.editor[s.label] }))}
      />
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        aria-label={m.editor.bulkList}
        placeholder={m.editor.bulkPlaceholder(separator)}
      />
    </Sheet>
  )
}
