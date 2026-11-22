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

const letter = (i: number) => String.fromCharCode(65 + i)

export function DeckEditor({ deck: initial }: { deck: Deck }) {
  const { saveDeck, removeDeck } = useDecks()
  const [deck, setDeck] = useState(initial)
  const [status, setStatus] = useState<'saved' | 'saving'>('saved')
  const [bulkOpen, setBulkOpen] = useState(false)
  const latest = useRef(deck)
  const dirty = useRef(false)

  useEffect(() => {
    latest.current = deck
    if (!dirty.current) return
    setStatus('saving')
    const t = setTimeout(() => {
      dirty.current = false
      saveDeck(latest.current)
        .then(() => setStatus('saved'))
        .catch(() => notify('Nie udało się zapisać', 'Możliwe, że zabrakło miejsca w pamięci przeglądarki.', 'error'))
    }, 400)
    return () => clearTimeout(t)
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
        } else {
          void saveDeck({ ...d, cards })
        }
      }, 0)
    }
  }, [removeDeck, saveDeck])

  const update = useCallback((fn: (d: Deck) => Deck) => {
    dirty.current = true
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
        title={deck.title.trim() || 'Nowy zestaw'}
        subtitle={status === 'saving' ? 'Zapisywanie…' : 'Zapisano w przeglądarce'}
        actions={
          <Button variant="primary" onClick={() => navigate(`/deck/${deck.id}`)}>
            Gotowe
          </Button>
        }
      />
      <Page>
        <div className="Stack">
          <Field label="Tytuł zestawu">
            <FieldControl
              className="Input"
              value={deck.title}
              onValueChange={(title) => update((d) => ({ ...d, title }))}
              placeholder="np. Materiałoznawstwo – stale"
              autoFocus={!deck.title}
            />
          </Field>
          <Field label="Opis">
            <FieldControl
              render={<TextArea rows={2} />}
              value={deck.description}
              onValueChange={(description) => update((d) => ({ ...d, description }))}
              placeholder="Opcjonalnie"
            />
          </Field>
          <LatexHelp />
        </div>

        <Section
          title={pluralCards(deck.cards.length)}
          actions={<Button onClick={() => setBulkOpen(true)}>Wklej listę fiszek</Button>}
        >
          <ol className="Stack PlainList">
            {deck.cards.map((card, index) => (
              <CardEditor key={card.id} card={card} index={index} onChange={updateCard} onRemove={removeCard} />
            ))}
          </ol>
          <div>
            <Button variant="primary" onClick={addCard}>
              <PlusIcon /> Dodaj fiszkę
            </Button>
          </div>
        </Section>
      </Page>

      <BulkImportSheet
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onImport={(cards) => {
          update((d) => ({ ...d, cards: [...d.cards.filter((c) => !isCardEmpty(c)), ...cards] }))
          notify(`Dodano: ${pluralCards(cards.length)}`)
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
  const setSide = (key: 'front' | 'back') => (side: Side) => onChange(card.id, (c) => ({ ...c, [key]: side }))
  const setChoices = (fn: (choices: Choice[]) => Choice[]) => onChange(card.id, (c) => ({ ...c, choices: fn(c.choices) }))

  return (
    <li className="EditorCard">
      <div className="EditorCard-header">
        <span className="EditorCard-title">Fiszka {index + 1}</span>
        <Button variant="ghost" onClick={() => onRemove(card.id)} aria-label={`Usuń fiszkę ${index + 1}`}>
          Usuń
        </Button>
      </div>
      <div className="EditorSides">
        <SideEditor id={`card-${card.id}-front`} label="Przód – pytanie / pojęcie" side={card.front} onChange={setSide('front')} />
        <SideEditor
          id={`card-${card.id}-back`}
          label="Tył – odpowiedź / definicja"
          side={card.back}
          onChange={setSide('back')}
          placeholder={card.choices.some((c) => c.correct) ? 'Opcjonalnie – poprawne odpowiedzi ABCD wystarczą' : undefined}
        />
      </div>
      <ChoicesEditor choices={card.choices} onChange={setChoices} />
    </li>
  )
})

function ImageButton({ onImage, label }: { onImage: (dataUrl: string) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button variant="ghost" onClick={() => input.current?.click()} aria-label={label}>
        <PlusIcon /> Zdjęcie
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
            notify('Nie udało się dodać zdjęcia', err instanceof Error ? err.message : undefined, 'error')
          }
        }}
      />
    </>
  )
}

function ImagePreview({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <figure className="ImagePreview">
      <img src={src} alt="" />
      <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Usuń zdjęcie">
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
  const setImage = (image?: string) => {
    const next: Side = { text: side.text }
    if (image) next.image = image
    onChange(next)
  }

  return (
    <div className="Field">
      <div className="Field-label">
        <label htmlFor={id}>{label}</label>
        <ImageButton onImage={setImage} label={`Dodaj zdjęcie: ${label}`} />
      </div>
      <TextArea
        id={id}
        value={side.text}
        rows={3}
        placeholder={placeholder ?? 'Tekst, wzory: $E = mc^2$'}
        onChange={(e) => onChange({ ...side, text: e.target.value })}
        onPaste={async (e) => {
          const file = imageFromClipboard(e)
          if (!file) return
          e.preventDefault()
          try {
            setImage(await imageFileToDataUrl(file))
          } catch (err) {
            notify('Nie udało się wkleić zdjęcia', err instanceof Error ? err.message : undefined, 'error')
          }
        }}
      />
      {side.image && <ImagePreview src={side.image} onRemove={() => setImage(undefined)} />}
      {hasMath(side.text) && (
        <div className="Preview">
          <span className="Hint">Podgląd</span>
          <RichText text={side.text} />
        </div>
      )}
    </div>
  )
}

function ChoicesEditor({ choices, onChange }: { choices: Choice[]; onChange: (fn: (c: Choice[]) => Choice[]) => void }) {
  const [open, setOpen] = useState(choices.length > 0)
  const updateChoice = (id: string, patch: Partial<Choice>) =>
    onChange((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  return (
    <Collapsible.Root className="Collapsible-box" open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="Collapsible-trigger">
        <ChevronRightIcon className="Collapsible-icon" />
        Własne odpowiedzi ABCD
        <span className="Muted">{choices.length > 0 ? `(${choices.length})` : '– opcjonalnie'}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="Collapsible-panel">
        <div className="Collapsible-content">
          <p className="Muted">
            Zaznacz wszystkie poprawne odpowiedzi – może być ich kilka. Bez własnych odpowiedzi tryb nauki losuje błędne
            odpowiedzi z innych fiszek.
          </p>
          <ul className="ChoiceList">
            {choices.map((choice, i) => (
              <li key={choice.id} className="ChoiceRow">
                <Checkbox
                  checked={choice.correct}
                  onCheckedChange={(correct) => updateChoice(choice.id, { correct })}
                  aria-label={`Odpowiedź ${letter(i)} jest poprawna`}
                />
                <TextInput
                  value={choice.text}
                  onValueChange={(text) => updateChoice(choice.id, { text })}
                  placeholder={`Odpowiedź ${letter(i)}`}
                />
                <ImageButton label={`Dodaj zdjęcie do odpowiedzi ${letter(i)}`} onImage={(image) => updateChoice(choice.id, { image })} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Usuń odpowiedź ${letter(i)}`}
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
              <PlusIcon /> Dodaj odpowiedź
            </Button>
          </div>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

function LatexHelp() {
  return (
    <Collapsible.Root className="Collapsible-box">
      <Collapsible.Trigger className="Collapsible-trigger">
        <ChevronRightIcon className="Collapsible-icon" />
        Jak wpisywać wzory i zdjęcia?
      </Collapsible.Trigger>
      <Collapsible.Panel className="Collapsible-panel">
        <ul className="Collapsible-content HelpList">
          <li>
            Wzór w tekście: <code>$\sigma = E\varepsilon$</code>
          </li>
          <li>
            Wzór w osobnej linii: <code>$$\int_0^l F\,dx$$</code>
          </li>
          <li>
            Znak dolara bez wzoru: <code>\$</code>
          </li>
          <li>Zdjęcie dodasz przyciskiem „Dodaj zdjęcie” albo wklejając je (Ctrl+V) do pola tekstowego.</li>
        </ul>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

const SEPARATORS = [
  { value: 'tab', label: 'Tabulator', sep: '\t' },
  { value: 'semicolon', label: 'Średnik ;', sep: ';' },
  { value: 'dash', label: 'Myślnik -', sep: ' - ' },
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
  const [sep, setSep] = useState<SeparatorKey>('tab')
  const separator = SEPARATORS.find((s) => s.value === sep)!.sep
  const cards = parseBulkText(text, separator)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Wklej listę fiszek"
      description="Jedna fiszka w linii: pojęcie, separator, definicja – np. skopiowane z arkusza kalkulacyjnego."
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
          Dodaj {cards.length > 0 ? pluralCards(cards.length) : 'fiszki'}
        </Button>
      }
    >
      <Segmented
        label="Separator"
        value={[sep]}
        onChange={([v]) => setSep(v)}
        options={SEPARATORS.map((s) => ({ value: s.value, label: s.label }))}
      />
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        aria-label="Lista fiszek"
        placeholder={`Ferryt${separator}roztwór stały węgla w Fe α\nModuł Younga${separator}$E = \\sigma/\\varepsilon$`}
      />
    </Sheet>
  )
}
