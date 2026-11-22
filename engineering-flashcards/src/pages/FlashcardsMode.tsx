import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Page, TopBar } from '../components/Layout'
import { SideContent } from '../components/RichContent'
import { Button, ProgressBar, Sheet, Switch } from '../components/ui'
import { usePref } from '../lib/prefs'
import { navigate } from '../lib/router'
import { isSideEmpty, shuffle, studyableCards } from '../lib/utils'
import type { Card, Deck, Side } from '../types'

interface Settings {
  shuffle: boolean
  startWithBack: boolean
  track: boolean
}

const DEFAULTS: Settings = { shuffle: false, startWithBack: false, track: true }

function backSide(card: Card): Side {
  if (!isSideEmpty(card.back) || card.choices.length === 0) return card.back
  return { text: card.choices.filter((c) => c.correct).map((c) => `• ${c.text}`).join('\n') }
}

export function FlashcardsMode({ deck }: { deck: Deck }) {
  const cards = useMemo(() => studyableCards(deck), [deck])
  const [settings, setSettings] = usePref<Settings>('flashcards', DEFAULTS)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const makeOrder = useCallback(
    (ids: string[]) => (settings.shuffle ? shuffle(ids) : ids),
    [settings.shuffle],
  )
  const [order, setOrder] = useState(() => makeOrder(cards.map((c) => c.id)))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<string>>(new Set())
  const [learning, setLearning] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<string[]>([])

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const card = byId.get(order[index] ?? '')
  const finished = index >= order.length

  const restart = (ids: string[]) => {
    setOrder(makeOrder(ids))
    setIndex(0)
    setFlipped(false)
    setKnown(new Set())
    setLearning(new Set())
    setHistory([])
  }

  const go = useCallback(
    (delta: number) => {
      setFlipped(false)
      setIndex((i) => Math.max(0, Math.min(order.length, i + delta)))
    },
    [order.length],
  )

  const mark = useCallback(
    (knows: boolean) => {
      if (!card) return
      const add = (set: Set<string>) => new Set(set).add(card.id)
      const del = (set: Set<string>) => {
        const next = new Set(set)
        next.delete(card.id)
        return next
      }
      setKnown((s) => (knows ? add(s) : del(s)))
      setLearning((s) => (knows ? del(s) : add(s)))
      setHistory((h) => [...h, card.id])
      go(1)
    },
    [card, go],
  )

  const undo = () => {
    const last = history.at(-1)
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    setKnown((s) => {
      const n = new Set(s)
      n.delete(last)
      return n
    })
    setLearning((s) => {
      const n = new Set(s)
      n.delete(last)
      return n
    })
    go(-1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen || finished) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [role="dialog"]')) return
      const onButton = e.target instanceof HTMLElement && e.target.closest('button')
      if (((e.key === ' ' || e.key === 'Enter') && !onButton) || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.key === 'ArrowRight') {
        if (settings.track) mark(true)
        else go(1)
      } else if (e.key === 'ArrowLeft') {
        if (settings.track) mark(false)
        else go(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, go, mark, settings.track, settingsOpen])

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    if (patch.shuffle !== undefined) {
      setOrder(next.shuffle ? shuffle(cards.map((c) => c.id)) : cards.map((c) => c.id))
      setIndex(0)
      setFlipped(false)
      setKnown(new Set())
      setLearning(new Set())
      setHistory([])
    }
  }

  return (
    <>
      <TopBar
        back={`/deck/${deck.id}`}
        title="Fiszki"
        subtitle={deck.title}
        actions={<Button onClick={() => setSettingsOpen(true)}>Ustawienia</Button>}
      />

      {finished ? (
        <Page>
          <h2>Koniec zestawu</h2>
          {settings.track ? (
            <dl>
              <dt>Umiesz</dt>
              <dd>{known.size}</dd>
              <dt>Jeszcze się uczysz</dt>
              <dd>{learning.size}</dd>
            </dl>
          ) : (
            <p>Przejrzałeś wszystkie fiszki: {order.length}.</p>
          )}
          {settings.track && learning.size > 0 && (
            <Button onClick={() => restart(order.filter((id) => learning.has(id)))}>
              Powtórz te, których nie umiesz ({learning.size})
            </Button>
          )}{' '}
          <Button onClick={() => restart(cards.map((c) => c.id))}>Zacznij od nowa</Button>{' '}
          <Button onClick={() => navigate(`/deck/${deck.id}/learn`)}>Przejdź do trybu nauki</Button>
        </Page>
      ) : card ? (
        <Page>
          <ProgressBar value={(index / order.length) * 100} label={`Fiszka ${index + 1} z ${order.length}`} />
          {settings.track && (
            <p>
              Nie umiem: {learning.size} · Umiem: {known.size}
            </p>
          )}

          <FlashcardView
            key={card.id}
            front={settings.startWithBack ? backSide(card) : card.front}
            back={settings.startWithBack ? card.front : backSide(card)}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            onSwipe={(dir) => (settings.track ? mark(dir === 'right') : go(dir === 'right' ? 1 : -1))}
          />

          <nav>
            {settings.track ? (
              <>
                <Button disabled={history.length === 0} onClick={undo}>
                  Cofnij
                </Button>{' '}
                <Button onClick={() => mark(false)}>Nie umiem</Button>{' '}
                <Button onClick={() => mark(true)}>Umiem</Button>
              </>
            ) : (
              <>
                <Button disabled={index === 0} onClick={() => go(-1)}>
                  Poprzednia
                </Button>{' '}
                <Button onClick={() => setFlipped((f) => !f)}>Odwróć</Button>{' '}
                <Button onClick={() => go(1)}>Następna</Button>
              </>
            )}
          </nav>
          <p>
            <small>
              Skróty: spacja – odwróć, ← {settings.track ? 'nie umiem' : 'poprzednia'}, → {settings.track ? 'umiem' : 'następna'}.
              Na telefonie możesz przesuwać kartę palcem.
            </small>
          </p>
        </Page>
      ) : null}

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen} title="Ustawienia fiszek">
        <Switch
          label="Śledź postęp"
          description="Oznaczaj fiszki jako „umiem” / „nie umiem” i powtarzaj trudne"
          checked={settings.track}
          onCheckedChange={(track) => updateSettings({ track })}
        />
        <Switch label="Losowa kolejność" checked={settings.shuffle} onCheckedChange={(shuffle) => updateSettings({ shuffle })} />
        <Switch
          label="Zaczynaj od odpowiedzi"
          description="Pokazuj najpierw tył fiszki"
          checked={settings.startWithBack}
          onCheckedChange={(startWithBack) => updateSettings({ startWithBack })}
        />
      </Sheet>
    </>
  )
}

function FlashcardView({
  front,
  back,
  flipped,
  onFlip,
  onSwipe,
}: {
  front: Side
  back: Side
  flipped: boolean
  onFlip: () => void
  onSwipe: (dir: 'left' | 'right') => void
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={flipped ? 'Pokaż pytanie' : 'Pokaż odpowiedź'}
      data-flipped={flipped || undefined}
      onClick={() => {
        if (swiped.current) {
          swiped.current = false
          return
        }
        onFlip()
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        start.current = { x: e.clientX, y: e.clientY }
        swiped.current = false
      }}
      onPointerUp={(e) => {
        if (!start.current) return
        const dx = e.clientX - start.current.x
        const dy = e.clientY - start.current.y
        start.current = null
        if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) {
          swiped.current = true
          onSwipe(dx > 0 ? 'right' : 'left')
        }
      }}
    >
      <h2>{flipped ? 'Odpowiedź' : 'Pytanie'}</h2>
      <SideContent side={flipped ? back : front} />
      <p>
        <small>Kliknij kartę, aby ją odwrócić.</small>
      </p>
    </article>
  )
}
