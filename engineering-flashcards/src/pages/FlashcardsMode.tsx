import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState, Page, Section, TopBar } from '../components/Layout'
import { SideContent } from '../components/RichContent'
import { Button, ProgressBar, Sheet, StarToggle, Switch, notify } from '../components/ui'
import { usePref } from '../lib/prefs'
import { navigate } from '../lib/router'
import { useStars } from '../lib/stars'
import { isSideEmpty, pluralCards, shuffle, studyableCards } from '../lib/utils'
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

export function FlashcardsMode({ deck, starredOnly }: { deck: Deck; starredOnly: boolean }) {
  const stars = useStars(deck.id)
  // Fixed for the session so unstarring a card doesn't reshuffle the cards being studied.
  const [starredAtStart] = useState(() => new Set(stars.starred))
  const pool = useMemo(() => studyableCards(deck), [deck])
  const cards = useMemo(
    () => pool.filter((c) => !starredOnly || starredAtStart.has(c.id)),
    [pool, starredOnly, starredAtStart],
  )
  const starredCount = pool.filter((c) => stars.isStarred(c.id)).length
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

  const toggleStar = stars.toggle
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
      } else if (e.key.toLowerCase() === 's' && card && !e.metaKey && !e.ctrlKey) {
        toggleStar(card.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, finished, go, mark, settings.track, settingsOpen, toggleStar])

  const starLearning = () => {
    const missing = [...learning].filter((id) => !stars.isStarred(id))
    missing.forEach(toggleStar)
    notify(missing.length === 1 ? '1 card starred' : `${missing.length} cards starred`)
  }

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
        title={starredOnly ? 'Flashcards · starred' : 'Flashcards'}
        subtitle={deck.title}
        actions={<Button onClick={() => setSettingsOpen(true)}>Settings</Button>}
      />

      {starredOnly && cards.length === 0 ? (
        <Page>
          <EmptyState
            title="No starred cards"
            description="Star the cards you want to focus on – in the deck view or while studying – and practise only those here."
          >
            <Button variant="primary" onClick={() => navigate(`/deck/${deck.id}/flashcards`, { replace: true })}>
              Study all cards
            </Button>
          </EmptyState>
        </Page>
      ) : finished ? (
        <Page>
          <Section title="End of deck">
            {settings.track ? (
              <div className="Summary">
                <div>
                  <span className="Summary-value">{known.size}</span>
                  <span className="Summary-label">Know</span>
                </div>
                <div>
                  <span className="Summary-value">{learning.size}</span>
                  <span className="Summary-label">Still learning</span>
                </div>
              </div>
            ) : (
              <p className="Lead">You went through all {order.length} cards.</p>
            )}
            <div className="Row">
              {settings.track && learning.size > 0 && (
                <Button variant="primary" onClick={() => restart(order.filter((id) => learning.has(id)))}>
                  Repeat the ones you don't know ({learning.size})
                </Button>
              )}
              {settings.track && [...learning].some((id) => !stars.isStarred(id)) && (
                <Button onClick={starLearning}>Star the ones you don't know</Button>
              )}
              <Button onClick={() => restart(cards.map((c) => c.id))}>Start over</Button>
              <Button onClick={() => navigate(`/deck/${deck.id}/learn`)}>Go to learn mode</Button>
            </div>
          </Section>
        </Page>
      ) : card ? (
        <Page>
          <div className="Stack">
            <ProgressBar value={(index / order.length) * 100} label={`Card ${index + 1} of ${order.length}`} />
            {settings.track && (
              <div className="Stats">
                <span>
                  Don't know: <strong>{learning.size}</strong>
                </span>
                <span>
                  Know: <strong>{known.size}</strong>
                </span>
              </div>
            )}
          </div>

          <FlashcardView
            key={card.id}
            front={settings.startWithBack ? backSide(card) : card.front}
            back={settings.startWithBack ? card.front : backSide(card)}
            flipped={flipped}
            starred={stars.isStarred(card.id)}
            onStar={() => toggleStar(card.id)}
            onFlip={() => setFlipped((f) => !f)}
            onSwipe={(dir) => (settings.track ? mark(dir === 'right') : go(dir === 'right' ? 1 : -1))}
          />

          <div className="Stack">
            <nav className="Controls">
              {settings.track ? (
                <>
                  <Button disabled={history.length === 0} onClick={undo}>
                    Undo
                  </Button>
                  <Button onClick={() => mark(false)}>Don't know</Button>
                  <Button variant="primary" onClick={() => mark(true)}>
                    Know
                  </Button>
                </>
              ) : (
                <>
                  <Button disabled={index === 0} onClick={() => go(-1)}>
                    Previous
                  </Button>
                  <Button onClick={() => setFlipped((f) => !f)}>Flip</Button>
                  <Button variant="primary" onClick={() => go(1)}>
                    Next
                  </Button>
                </>
              )}
            </nav>
            <p className="Hint">
              Shortcuts: space – flip, ← {settings.track ? "don't know" : 'previous'}, → {settings.track ? 'know' : 'next'}, S –
              star. On a phone you can swipe the card.
            </p>
          </div>
        </Page>
      ) : null}

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen} title="Flashcard settings">
        <div className="SettingsForm">
          <Switch
            label="Only starred cards"
            description={
              starredCount > 0
                ? `Practise only the ${pluralCards(starredCount)} you starred`
                : 'Star cards first to use this'
            }
            checked={starredOnly}
            disabled={!starredOnly && starredCount === 0}
            onCheckedChange={(on) =>
              navigate(`/deck/${deck.id}/flashcards${on ? '/starred' : ''}`, { replace: true })
            }
          />
          <Switch
            label="Track progress"
            description="Mark cards as “know” / “don't know” and repeat the hard ones"
            checked={settings.track}
            onCheckedChange={(track) => updateSettings({ track })}
          />
          <Switch label="Shuffle" checked={settings.shuffle} onCheckedChange={(shuffle) => updateSettings({ shuffle })} />
          <Switch
            label="Start with the answer"
            description="Show the back of the card first"
            checked={settings.startWithBack}
            onCheckedChange={(startWithBack) => updateSettings({ startWithBack })}
          />
        </div>
      </Sheet>
    </>
  )
}

function FlashcardView({
  front,
  back,
  flipped,
  starred,
  onStar,
  onFlip,
  onSwipe,
}: {
  front: Side
  back: Side
  flipped: boolean
  starred: boolean
  onStar: () => void
  onFlip: () => void
  onSwipe: (dir: 'left' | 'right') => void
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  return (
    <article
      className="Flashcard"
      role="button"
      tabIndex={0}
      aria-label={flipped ? 'Show question' : 'Show answer'}
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
      <div className="Flashcard-header">
        <h2 className="Flashcard-label">{flipped ? 'Answer' : 'Question'}</h2>
        <StarToggle starred={starred} onToggle={onStar} />
      </div>
      <div className="Flashcard-body" key={flipped ? 'back' : 'front'}>
        <SideContent side={flipped ? back : front} />
      </div>
      <p className="Flashcard-hint">Click the card to flip it</p>
    </article>
  )
}
