import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { Page, Section, TopBar } from '../components/Layout'
import { SideContent } from '../components/RichContent'
import {
  Button,
  CheckIcon,
  Field,
  FieldControl,
  Fieldset,
  ProgressBar,
  Segmented,
  Sheet,
  Switch,
} from '../components/ui'
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
          <Section title="Ustaw sesję nauki">
            <p className="Muted">
              Fiszka jest opanowana, gdy odpowiesz na nią poprawnie dwa razy – najpierw rozpoznając odpowiedź, potem
              wpisując ją samodzielnie.
            </p>
          </Section>
          <LearnSettingsForm settings={settings} onChange={setSettings} />
          <div>
            <Button variant="primary" size="lg" onClick={() => start()}>
              Zacznij naukę
            </Button>
          </div>
        </Page>
      ) : phase === 'done' ? (
        <Page>
          <LearnProgress counts={counts} total={cards.length} />
          <Section title="Cały zestaw opanowany">
            <p className="Lead">
              Wszystkie fiszki ({cards.length}) zaliczone w rundach: {session?.roundNumber}.
            </p>
            <div className="Row">
              <Button variant="primary" onClick={() => start()}>
                Ucz się od nowa
              </Button>
              <Button onClick={() => navigate(`/deck/${deck.id}/flashcards`)}>Powtórz na fiszkach</Button>
            </div>
          </Section>
        </Page>
      ) : phase === 'summary' && session ? (
        <Page>
          <LearnProgress counts={counts} total={cards.length} />
          <Section
            title={`Koniec rundy ${session.roundNumber}`}
            actions={
              <Button variant="primary" onClick={continueRound}>
                Następna runda
              </Button>
            }
          >
            <p className="Lead">
              Poprawnie: {session.results.filter((r) => r.correct).length} z {session.results.length}.
            </p>
            <ol className="Results">
              {session.results.map((r, i) => {
                const card = byId.get(r.cardId)
                if (!card) return null
                return (
                  <li key={`${r.cardId}-${i}`}>
                    <span
                      className="Mark"
                      data-correct={r.correct || undefined}
                      data-wrong={!r.correct || undefined}
                      aria-label={r.correct ? 'Dobrze' : 'Źle'}
                    >
                      {r.correct ? '✓' : '✕'}
                    </span>
                    <SideContent side={card.front} />
                    <div className="CardRow-back">
                      <SideContent side={card.back} />
                    </div>
                  </li>
                )
              })}
            </ol>
          </Section>
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
    <div className="SettingsForm">
      <Fieldset legend="Typy pytań">
        <Segmented<QuestionType>
          label="Typy pytań"
          multiple
          value={settings.types}
          onChange={(types) => onChange({ ...settings, types })}
          options={(['mc', 'tf', 'written'] as const).map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))}
        />
      </Fieldset>
      <Fieldset legend="Odpowiadaj za pomocą">
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
        <p className="Hint">
          „Tyłu” – widzisz pytanie, podajesz odpowiedź. Fiszki z własnymi odpowiedziami ABCD zawsze pytają o tył.
        </p>
      </Fieldset>
      <Fieldset legend="Fiszek w rundzie">
        <Segmented<string>
          label="Fiszek w rundzie"
          value={[String(settings.roundSize)]}
          onChange={([v]) => onChange({ ...settings, roundSize: Number(v) })}
          options={['5', '7', '10', '20'].map((v) => ({ value: v, label: v }))}
        />
      </Fieldset>
      <Switch label="Losowa kolejność" checked={settings.shuffle} onCheckedChange={(shuffle) => onChange({ ...settings, shuffle })} />
    </div>
  )
}

function LearnProgress({ counts, total }: { counts: { new: number; learning: number; mastered: number }; total: number }) {
  return (
    <div className="Stack">
      <ProgressBar value={(counts.mastered / Math.max(1, total)) * 100} label="Opanowane" />
      <div className="Stats">
        <span>
          Nowe: <strong>{counts.new}</strong>
        </span>
        <span>
          W trakcie: <strong>{counts.learning}</strong>
        </span>
        <span>
          Opanowane: <strong>{counts.mastered}</strong>
        </span>
      </div>
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
    <section className="Question">
      <h2 className="Flashcard-label">{question.prompt === question.card.front ? 'Pytanie' : 'Odpowiedź'}</h2>
      <div className="Question-prompt">
        <SideContent side={question.prompt} />
      </div>
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
    <div className="Stack">
      <p className="Muted">{question.multi ? 'Zaznacz wszystkie poprawne odpowiedzi:' : 'Wybierz poprawną odpowiedź:'}</p>
      <ol className="Options">
        {question.options.map((o, i) => {
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
              <BaseButton
                className="Option"
                disabled={answered}
                onClick={() => choose(o.id)}
                aria-pressed={picked}
                data-result={result}
              >
                <span className="Option-key">{picked && question.multi ? <CheckIcon /> : String.fromCharCode(65 + i)}</span>
                <span className="Option-body">
                  <SideContent side={o.side} />
                </span>
                {result && (
                  <span className="Option-result">
                    {result === 'correct' && '✓ poprawna'}
                    {result === 'missed' && '✓ pominięta'}
                    {result === 'wrong' && '✕ błędna'}
                  </span>
                )}
              </BaseButton>
            </li>
          )
        })}
      </ol>
      {question.multi && !answered && (
        <div>
          <Button variant="primary" disabled={selected.length === 0} onClick={() => submit(selected)}>
            Sprawdź
          </Button>
        </div>
      )}
      {!answered && <p className="Hint">Możesz też wybierać klawiszami 1–{question.options.length}.</p>}
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
    <div className="Stack">
      <p className="Muted">Czy to poprawna odpowiedź?</p>
      <blockquote className="Candidate">
        <SideContent side={question.candidate} />
      </blockquote>
      <div className="TwoButtons">
        <Button disabled={answered} onClick={() => onAnswer(question.isTrue, { selected: ['true'] })}>
          Prawda
        </Button>
        <Button disabled={answered} onClick={() => onAnswer(!question.isTrue, { selected: ['false'] })}>
          Fałsz
        </Button>
      </div>
      {answered && <p className="Muted">To {question.isTrue ? 'prawda' : 'fałsz'}.</p>}
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
      className="WrittenForm"
      onSubmit={(e) => {
        e.preventDefault()
        if (answered || !value.trim()) return
        const result = checkWritten(value, question.accepted)
        onAnswer(result !== 'wrong', { given: value, typo: result === 'typo' })
      }}
    >
      <Field label="Wpisz odpowiedź">
        <FieldControl
          className="Input"
          value={value}
          onValueChange={setValue}
          disabled={answered}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </Field>
      {!answered && (
        <div className="Row">
          <Button variant="primary" type="submit" disabled={!value.trim()}>
            Sprawdź
          </Button>
          <Button type="button" variant="ghost" onClick={() => onAnswer(false, { given: '' })}>
            Nie wiem
          </Button>
        </div>
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
      <div className="Stack">
        <p className="Muted">Przypomnij sobie odpowiedź, a potem ją odkryj.</p>
        <div>
          <Button variant="primary" onClick={() => setRevealed(true)}>
            Pokaż odpowiedź
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="Stack">
      <blockquote className="Candidate">
        <SideContent side={question.answer} />
      </blockquote>
      <p className="Muted">Czy znałeś odpowiedź?</p>
      <div className="TwoButtons">
        <Button onClick={() => onAnswer(false)}>Nie</Button>
        <Button variant="primary" onClick={() => onAnswer(true)}>
          Tak
        </Button>
      </div>
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
    <aside className="Feedback" role="status" data-correct={feedback.correct}>
      <h3 className="Feedback-title">
        {feedback.correct
          ? feedback.typo
            ? 'Dobrze, ale sprawdź pisownię'
            : 'Dobrze!'
          : feedback.given === ''
            ? 'Wrócimy do tej fiszki'
            : 'Źle – wrócimy do tej fiszki'}
      </h3>
      {(!feedback.correct || feedback.typo || question.kind === 'written') && (
        <div className="Feedback-answer">
          <p className="Muted">Poprawna odpowiedź:</p>
          <SideContent side={question.answer} />
        </div>
      )}
      <div className="Row">
        <Button variant="primary" onClick={onNext}>
          Dalej (Enter)
        </Button>
        {onOverride && (
          <Button variant="ghost" onClick={onOverride}>
            Moja odpowiedź była poprawna
          </Button>
        )}
      </div>
    </aside>
  )
}
