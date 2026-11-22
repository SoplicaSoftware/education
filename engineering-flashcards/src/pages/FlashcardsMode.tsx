import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState, Page, Section, TopBar } from '../components/Layout'
import { SideContent } from '../components/RichContent'
import { Button, ProgressBar, Sheet, StarToggle, Switch, notify } from '../components/ui'
import { usePref } from '../lib/prefs'
import { navigate } from '../lib/router'
import { useStars } from '../lib/stars'
import { isSideEmpty, pluralCards, shuffle, studyableCards } from '../lib/utils'
import type { Card, Deck, Side } from '../types'
import { useT } from '../lib/i18n'

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
  const m = useT()
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
    notify(m.star.added(missing.length))
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
        title={starredOnly ? m.flashcards.titleStarred : m.common.flashcards}
        subtitle={deck.title}
        actions={<Button onClick={() => setSettingsOpen(true)}>{m.common.settings}</Button>}
      />

      {starredOnly && cards.length === 0 ? (
        <Page>
          <EmptyState
            title={m.common.noStarred}
            description={m.flashcards.noStarredText}
          >
            <Button variant="primary" onClick={() => navigate(`/deck/${deck.id}/flashcards`, { replace: true })}>
              {m.common.studyAll}
            </Button>
          </EmptyState>
        </Page>
      ) : finished ? (
        <Page>
          <Section title={m.flashcards.end}>
            {settings.track ? (
              <div className="Summary">
                <div>
                  <span className="Summary-value">{known.size}</span>
                  <span className="Summary-label">{m.flashcards.know}</span>
                </div>
                <div>
                  <span className="Summary-value">{learning.size}</span>
                  <span className="Summary-label">{m.flashcards.stillLearning}</span>
                </div>
              </div>
            ) : (
              <p className="Lead">{m.flashcards.wentThrough(order.length)}</p>
            )}
            <div className="Row">
              {settings.track && learning.size > 0 && (
                <Button variant="primary" onClick={() => restart(order.filter((id) => learning.has(id)))}>
                  {m.flashcards.repeat(learning.size)}
                </Button>
              )}
              {settings.track && [...learning].some((id) => !stars.isStarred(id)) && (
                <Button onClick={starLearning}>{m.flashcards.starUnknown}</Button>
              )}
              <Button onClick={() => restart(cards.map((c) => c.id))}>{m.flashcards.startOver}</Button>
              <Button onClick={() => navigate(`/deck/${deck.id}/learn`)}>{m.flashcards.toLearn}</Button>
            </div>
          </Section>
        </Page>
      ) : card ? (
        <Page>
          <div className="Stack">
            <ProgressBar value={(index / order.length) * 100} label={m.flashcards.progress(index + 1, order.length)} />
            {settings.track && (
              <div className="Stats">
                <span>
                  {m.flashcards.dontKnowStat} <strong>{learning.size}</strong>
                </span>
                <span>
                  {m.flashcards.knowStat} <strong>{known.size}</strong>
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
                    {m.flashcards.undo}
                  </Button>
                  <Button onClick={() => mark(false)}>{m.flashcards.dontKnow}</Button>
                  <Button variant="primary" onClick={() => mark(true)}>
                    {m.flashcards.know}
                  </Button>
                </>
              ) : (
                <>
                  <Button disabled={index === 0} onClick={() => go(-1)}>
                    {m.flashcards.previous}
                  </Button>
                  <Button onClick={() => setFlipped((f) => !f)}>{m.flashcards.flip}</Button>
                  <Button variant="primary" onClick={() => go(1)}>
                    {m.flashcards.next}
                  </Button>
                </>
              )}
            </nav>
            <p className="Hint">{m.flashcards.shortcuts(settings.track)}</p>
          </div>
        </Page>
      ) : null}

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen} title={m.flashcards.settingsTitle}>
        <div className="SettingsForm">
          <Switch
            label={m.common.onlyStarred}
            description={starredCount > 0 ? m.flashcards.onlyStarredText(pluralCards(starredCount)) : m.common.starFirst}
            checked={starredOnly}
            disabled={!starredOnly && starredCount === 0}
            onCheckedChange={(on) =>
              navigate(`/deck/${deck.id}/flashcards${on ? '/starred' : ''}`, { replace: true })
            }
          />
          <Switch
            label={m.flashcards.track}
            description={m.flashcards.trackText}
            checked={settings.track}
            onCheckedChange={(track) => updateSettings({ track })}
          />
          <Switch label={m.common.shuffle} checked={settings.shuffle} onCheckedChange={(shuffle) => updateSettings({ shuffle })} />
          <Switch
            label={m.flashcards.startWithBack}
            description={m.flashcards.startWithBackText}
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
  const m = useT()
  const swiped = useRef(false)

  return (
    <article
      className="Flashcard"
      role="button"
      tabIndex={0}
      aria-label={flipped ? m.flashcards.showQuestion : m.flashcards.showAnswer}
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
        <h2 className="Flashcard-label">{flipped ? m.common.answer : m.common.question}</h2>
        <StarToggle starred={starred} onToggle={onStar} />
      </div>
      <div className="Flashcard-body" key={flipped ? 'back' : 'front'}>
        <SideContent side={flipped ? back : front} />
      </div>
      <p className="Flashcard-hint">{m.flashcards.clickToFlip}</p>
    </article>
  )
}
