import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Page, TopBar } from '../components/Layout'
import { SideContent } from '../components/RichContent'
import { Button, ProgressBar, Segmented, Sheet, Switch, TextInput } from '../components/ui'
import {
  DEFAULT_SETTINGS,
  QUESTION_TYPE_LABELS,
  buildQuestion,
  checkWritten,
  type AnswerWith,
  type LearnSettings,
  type Question,
  type QuestionType,
  type Stage,
} from '../lib/learn'
import { usePref } from '../lib/prefs'
import { navigate } from '../lib/router'
import { shuffle, studyableCards } from '../lib/utils'
import type { Deck } from '../types'

type Phase = 'setup' | 'question' | 'feedback' | 'summary' | 'done'

interface Feedback {
  correct: boolean
  typo?: boolean
  given?: string
  selected?: string[]
  prevStage: Stage
}

interface Session {
  stages: Record<string, Stage>
  attempted: Set<string>
  order: string[]
  round: string[]
  pos: number
  results: Array<{ cardId: string; correct: boolean }>
  roundNumber: number
}


function nextRound(order: string[], stages: Record<string, Stage>, attempted: Set<string>, size: number) {
  const open = order.filter((id) => stages[id] !== 2)
  return [...open.filter((id) => attempted.has(id)), ...open.filter((id) => !attempted.has(id))].slice(0, size)
}

export function LearnMode({ deck }: { deck: Deck }) {
  const cards = useMemo(() => studyableCards(deck), [deck])
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const [settings, setSettings] = usePref<LearnSettings>('learn', DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('setup')
  const [session, setSession] = useState<Session | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const ask = useCallback(
    (s: Session) => {
      const card = byId.get(s.round[s.pos])
      if (!card) return
      setQuestion(buildQuestion(card, s.stages[card.id] ?? 0, cards, settings))
      setFeedback(null)
      setPhase('question')
    },
    [byId, cards, settings],
  )

  const start = useCallback(
    (opts: LearnSettings = settings) => {
      const ids = cards.map((c) => c.id)
      const order = opts.shuffle ? shuffle(ids) : ids
      const stages: Record<string, Stage> = {}
      const s: Session = {
        stages,
        attempted: new Set(),
        order,
        round: nextRound(order, stages, new Set(), opts.roundSize),
        pos: 0,
        results: [],
        roundNumber: 1,
      }
      setSession(s)
      const card = byId.get(s.round[0])
      if (card) {
        setQuestion(buildQuestion(card, 0, cards, opts))
        setFeedback(null)
        setPhase('question')
      }
    },
    [byId, cards, settings],
  )

  const answer = (correct: boolean, extra: Partial<Feedback> = {}) => {
    if (!session || !question) return
    const id = question.card.id
    const prevStage = session.stages[id] ?? 0
    const stage: Stage = correct ? (Math.min(2, prevStage + 1) as Stage) : 0
    setSession({
      ...session,
      stages: { ...session.stages, [id]: stage },
      attempted: new Set(session.attempted).add(id),
      results: [...session.results, { cardId: id, correct }],
    })
    setFeedback({ correct, prevStage, ...extra })
    setPhase('feedback')
  }

  const overrideCorrect = () => {
    if (!session || !question || !feedback) return
    const id = question.card.id
    const stage = Math.min(2, feedback.prevStage + 1) as Stage
    setSession({
      ...session,
      stages: { ...session.stages, [id]: stage },
      results: session.results.map((r, i) => (i === session.results.length - 1 ? { ...r, correct: true } : r)),
    })
    setFeedback({ ...feedback, correct: true })
  }

  const next = useCallback(() => {
    if (!session) return
    const pos = session.pos + 1
    if (pos < session.round.length) {
      const s = { ...session, pos }
      setSession(s)
      ask(s)
      return
    }
    const allMastered = session.order.every((id) => session.stages[id] === 2)
    setPhase(allMastered ? 'done' : 'summary')
  }, [ask, session])

  const continueRound = () => {
    if (!session) return
    const s: Session = {
      ...session,
      round: nextRound(session.order, session.stages, session.attempted, settings.roundSize),
      pos: 0,
      results: [],
      roundNumber: session.roundNumber + 1,
    }
    setSession(s)
    ask(s)
  }

  useEffect(() => {
    if (phase !== 'feedback') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !settingsOpen) {
        e.preventDefault()
        next()
      }
    }
    // Defer so the Enter that submitted the answer doesn't also skip the feedback.
    const t = setTimeout(() => window.addEventListener('keydown', onKey), 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [phase, next, settingsOpen])

  const counts = useMemo(() => {
    const c = { new: 0, learning: 0, mastered: 0 }
    for (const card of cards) {
      const stage = session?.stages[card.id] ?? 0
      if (stage === 2) c.mastered++
      else if (session?.attempted.has(card.id)) c.learning++
      else c.new++
    }
    return c
  }, [cards, session])

  const applySettings = (next: LearnSettings) => {
    setSettings(next)
    if (phase !== 'setup') start(next)
  }

  return (
    <>
      <TopBar
        back={`/deck/${deck.id}`}
        title="Nauka"
        subtitle={deck.title}
        actions={phase !== 'setup' && <Button onClick={() => setSettingsOpen(true)}>Ustawienia</Button>}
      />

      {phase === 'setup' ? (
        <Page>
          <h2>Ustaw sesję nauki</h2>
          <p>
            Fiszka jest opanowana, gdy odpowiesz na nią poprawnie dwa razy – najpierw rozpoznając odpowiedź, potem
            wpisując ją samodzielnie.
          </p>
          <LearnSettingsForm settings={settings} onChange={setSettings} />
          <Button onClick={() => start()}>Zacznij naukę</Button>
        </Page>
      ) : phase === 'done' ? (
        <Page>
          <h2>Cały zestaw opanowany</h2>
          <p>
            Wszystkie fiszki ({cards.length}) zaliczone w rundach: {session?.roundNumber}.
          </p>
          <Button onClick={() => start()}>Ucz się od nowa</Button>{' '}
          <Button onClick={() => navigate(`/deck/${deck.id}/flashcards`)}>Powtórz na fiszkach</Button>
        </Page>
      ) : phase === 'summary' && session ? (
        <Page>
          <LearnProgress counts={counts} total={cards.length} />
          <h2>Koniec rundy {session.roundNumber}</h2>
          <p>
            Poprawnie: {session.results.filter((r) => r.correct).length} z {session.results.length}.
          </p>
          <ol>
            {session.results.map((r, i) => {
              const card = byId.get(r.cardId)
              if (!card) return null
              return (
                <li key={`${r.cardId}-${i}`}>
                  <strong>{r.correct ? '✓ Dobrze' : '✗ Źle'}</strong>
                  <SideContent side={card.front} />
                  <SideContent side={card.back} />
                </li>
              )
            })}
          </ol>
          <Button onClick={continueRound}>Następna runda</Button>
        </Page>
      ) : question ? (
        <Page>
          <LearnProgress counts={counts} total={cards.length} />
          <QuestionView
            key={`${question.card.id}-${session?.roundNumber}-${session?.pos}`}
            question={question}
            feedback={feedback}
            onAnswer={answer}
          />
          {phase === 'feedback' && feedback && (
            <FeedbackPanel
              feedback={feedback}
              question={question}
              onNext={next}
              onOverride={question.kind === 'written' && !feedback.correct && feedback.given ? overrideCorrect : undefined}
            />
          )}
        </Page>
      ) : null}

      <Sheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Ustawienia nauki"
        description="Zmiana ustawień rozpoczyna sesję od nowa."
      >
        <LearnSettingsForm settings={settings} onChange={applySettings} />
      </Sheet>
    </>
  )
}

function LearnSettingsForm({ settings, onChange }: { settings: LearnSettings; onChange: (s: LearnSettings) => void }) {
  return (
    <div>
      <fieldset>
        <legend>Typy pytań</legend>
        <Segmented<QuestionType>
          label="Typy pytań"
          multiple
          value={settings.types}
          onChange={(types) => onChange({ ...settings, types })}
          options={(['mc', 'tf', 'written'] as const).map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))}
        />
      </fieldset>
      <fieldset>
        <legend>Odpowiadaj za pomocą</legend>
        <Segmented<AnswerWith>
          label="Odpowiadaj za pomocą"
          value={[settings.answerWith]}
          onChange={([answerWith]) => onChange({ ...settings, answerWith })}
          options={[
            { value: 'back', label: 'Tyłu' },
            { value: 'front', label: 'Przodu' },
            { value: 'both', label: 'Obu' },
          ]}
        />
        <p>
          <small>
            „Tyłu” – widzisz pytanie, podajesz odpowiedź. Fiszki z własnymi odpowiedziami ABCD zawsze pytają o tył.
          </small>
        </p>
      </fieldset>
      <fieldset>
        <legend>Fiszek w rundzie</legend>
        <Segmented<string>
          label="Fiszek w rundzie"
          value={[String(settings.roundSize)]}
          onChange={([v]) => onChange({ ...settings, roundSize: Number(v) })}
          options={['5', '7', '10', '20'].map((v) => ({ value: v, label: v }))}
        />
      </fieldset>
      <Switch label="Losowa kolejność" checked={settings.shuffle} onCheckedChange={(shuffle) => onChange({ ...settings, shuffle })} />
    </div>
  )
}

function LearnProgress({ counts, total }: { counts: { new: number; learning: number; mastered: number }; total: number }) {
  return (
    <div>
      <ProgressBar value={(counts.mastered / Math.max(1, total)) * 100} label="Opanowane" />
      <p>
        Nowe: {counts.new} · W trakcie: {counts.learning} · Opanowane: {counts.mastered}
      </p>
    </div>
  )
}

function QuestionView({
  question,
  feedback,
  onAnswer,
}: {
  question: Question
  feedback: Feedback | null
  onAnswer: (correct: boolean, extra?: Partial<Feedback>) => void
}) {
  return (
    <section>
      <h2>{question.prompt === question.card.front ? 'Pytanie' : 'Odpowiedź'}</h2>
      <SideContent side={question.prompt} />
      {question.kind === 'mc' && <MultipleChoice question={question} feedback={feedback} onAnswer={onAnswer} />}
      {question.kind === 'tf' && <TrueFalse question={question} feedback={feedback} onAnswer={onAnswer} />}
      {question.kind === 'written' && <Written question={question} feedback={feedback} onAnswer={onAnswer} />}
      {question.kind === 'self' && <SelfCheck question={question} feedback={feedback} onAnswer={onAnswer} />}
    </section>
  )
}

function MultipleChoice({
  question,
  feedback,
  onAnswer,
}: {
  question: Extract<Question, { kind: 'mc' }>
  feedback: Feedback | null
  onAnswer: (correct: boolean, extra?: Partial<Feedback>) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const answered = feedback !== null

  const submit = useCallback(
    (ids: string[]) => {
      const correctIds = question.options.filter((o) => o.correct).map((o) => o.id)
      const ok = ids.length === correctIds.length && ids.every((id) => correctIds.includes(id))
      onAnswer(ok, { selected: ids })
    },
    [onAnswer, question.options],
  )

  const choose = (id: string) => {
    if (answered) return
    if (question.multi) setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
    else submit([id])
  }

  const latest = useRef(choose)
  useEffect(() => {
    latest.current = choose
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [role="dialog"]')) return
      const n = Number(e.key)
      if (n >= 1 && n <= question.options.length) latest.current(question.options[n - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [question.options])

  return (
    <div>
      <p>{question.multi ? 'Zaznacz wszystkie poprawne odpowiedzi:' : 'Wybierz poprawną odpowiedź:'}</p>
      <ol type="A">
        {question.options.map((o) => {
          const picked = (feedback?.selected ?? selected).includes(o.id)
          const result = !answered
            ? undefined
            : o.correct
              ? picked
                ? 'correct'
                : 'missed'
              : picked
                ? 'wrong'
                : undefined
          return (
            <li key={o.id}>
              <Button disabled={answered} onClick={() => choose(o.id)} aria-pressed={picked} data-result={result}>
                {question.multi && (picked ? '☑ ' : '☐ ')}
                <SideContent side={o.side} />
              </Button>
              {result === 'correct' && ' ✓ poprawna'}
              {result === 'missed' && ' ✓ poprawna (nie zaznaczona)'}
              {result === 'wrong' && ' ✗ błędna'}
            </li>
          )
        })}
      </ol>
      {question.multi && !answered && (
        <Button disabled={selected.length === 0} onClick={() => submit(selected)}>
          Sprawdź
        </Button>
      )}
    </div>
  )
}

function TrueFalse({
  question,
  feedback,
  onAnswer,
}: {
  question: Extract<Question, { kind: 'tf' }>
  feedback: Feedback | null
  onAnswer: (correct: boolean, extra?: Partial<Feedback>) => void
}) {
  const answered = feedback !== null
  return (
    <div>
      <p>Czy to poprawna odpowiedź?</p>
      <blockquote>
        <SideContent side={question.candidate} />
      </blockquote>
      <Button disabled={answered} onClick={() => onAnswer(question.isTrue, { selected: ['true'] })}>
        Prawda
      </Button>{' '}
      <Button disabled={answered} onClick={() => onAnswer(!question.isTrue, { selected: ['false'] })}>
        Fałsz
      </Button>
      {answered && <p>To {question.isTrue ? 'prawda' : 'fałsz'}.</p>}
    </div>
  )
}

function Written({
  question,
  feedback,
  onAnswer,
}: {
  question: Extract<Question, { kind: 'written' }>
  feedback: Feedback | null
  onAnswer: (correct: boolean, extra?: Partial<Feedback>) => void
}) {
  const [value, setValue] = useState('')
  const answered = feedback !== null
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (answered || !value.trim()) return
        const result = checkWritten(value, question.accepted)
        onAnswer(result !== 'wrong', { given: value, typo: result === 'typo' })
      }}
    >
      <label>
        Wpisz odpowiedź{' '}
        <TextInput
          value={value}
          onValueChange={setValue}
          disabled={answered}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>
      {!answered && (
        <>
          {' '}
          <Button type="submit" disabled={!value.trim()}>
            Sprawdź
          </Button>{' '}
          <Button type="button" onClick={() => onAnswer(false, { given: '' })}>
            Nie wiem
          </Button>
        </>
      )}
    </form>
  )
}

function SelfCheck({
  question,
  feedback,
  onAnswer,
}: {
  question: Extract<Question, { kind: 'self' }>
  feedback: Feedback | null
  onAnswer: (correct: boolean) => void
}) {
  const [revealed, setRevealed] = useState(false)
  if (feedback) return null
  if (!revealed) {
    return (
      <div>
        <p>Przypomnij sobie odpowiedź, a potem ją odkryj.</p>
        <Button onClick={() => setRevealed(true)}>Pokaż odpowiedź</Button>
      </div>
    )
  }
  return (
    <div>
      <SideContent side={question.answer} />
      <p>Czy znałeś odpowiedź?</p>
      <Button onClick={() => onAnswer(false)}>Nie</Button> <Button onClick={() => onAnswer(true)}>Tak</Button>
    </div>
  )
}

function FeedbackPanel({
  feedback,
  question,
  onNext,
  onOverride,
}: {
  feedback: Feedback
  question: Question
  onNext: () => void
  onOverride?: () => void
}) {
  return (
    <aside role="status" data-correct={feedback.correct}>
      <h3>
        {feedback.correct
          ? feedback.typo
            ? 'Dobrze, ale sprawdź pisownię'
            : 'Dobrze!'
          : feedback.given === ''
            ? 'Wrócimy do tej fiszki'
            : 'Źle – wrócimy do tej fiszki'}
      </h3>
      {(!feedback.correct || feedback.typo || question.kind === 'written') && (
        <div>
          <p>Poprawna odpowiedź:</p>
          <SideContent side={question.answer} />
        </div>
      )}
      {onOverride && <Button onClick={onOverride}>Moja odpowiedź była poprawna</Button>}{' '}
      <Button onClick={onNext}>Dalej (Enter)</Button>
    </aside>
  )
}
