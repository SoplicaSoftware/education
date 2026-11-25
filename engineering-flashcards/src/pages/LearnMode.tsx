import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { EmptyState, Page, Section, TopBar } from '../components/Layout'
import { Explanation, SideContent } from '../components/RichContent'
import {
  Button,
  CheckIcon,
  ConfirmDialog,
  Field,
  FieldControl,
  Fieldset,
  ProgressBar,
  Segmented,
  Sheet,
  StarToggle,
  Switch,
} from '../components/ui'
import {
  DEFAULT_SETTINGS,
  buildQuestion,
  checkWritten,
  type AnswerWith,
  type LearnSettings,
  type Question,
  type QuestionType,
  type Stage,
} from '../lib/learn'
import { usePref } from '../lib/prefs'
import { clearProgress, loadProgress, progressKey, saveProgress, sameCards } from '../lib/progress'
import { navigate } from '../lib/router'
import { useStars } from '../lib/stars'
import { pluralCards, shuffle, studyableCards } from '../lib/utils'
import type { Deck } from '../types'
import { useT } from '../lib/i18n'

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

type SavedSession = Omit<Session, 'attempted'> & { attempted: string[] }
interface SavedLearn {
  phase: Phase
  session: SavedSession
}

function restoreLearn(saved: SavedLearn | null, ids: string[]): { phase: Phase; session: Session } | null {
  if (!saved?.session || saved.phase === 'setup' || !sameCards(saved.session.order, ids)) return null
  return { phase: saved.phase, session: { ...saved.session, attempted: new Set(saved.session.attempted) } }
}

function nextRound(order: string[], stages: Record<string, Stage>, attempted: Set<string>, size: number) {
  const open = order.filter((id) => stages[id] !== 2)
  return [...open.filter((id) => attempted.has(id)), ...open.filter((id) => !attempted.has(id))].slice(0, size)
}

export function LearnMode({ deck, starredOnly }: { deck: Deck; starredOnly: boolean }) {
  const stars = useStars(deck.id)
  const m = useT()
  const [starredAtStart] = useState(() => new Set(stars.starred))
  const pool = useMemo(() => studyableCards(deck), [deck])
  const cards = useMemo(
    () => pool.filter((c) => !starredOnly || starredAtStart.has(c.id)),
    [pool, starredOnly, starredAtStart],
  )
  const starredCount = pool.filter((c) => stars.isStarred(c.id)).length
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const [settings, setSettings] = usePref<LearnSettings>('learn', DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('setup')
  const [session, setSession] = useState<Session | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const storageKey = progressKey('learn', deck.id, starredOnly)
  const [restored] = useState(() => restoreLearn(loadProgress<SavedLearn>(storageKey), cards.map((c) => c.id)))

  const ask = useCallback(
    (s: Session) => {
      const card = byId.get(s.round[s.pos])
      if (!card) return
      setQuestion(buildQuestion(card, s.stages[card.id] ?? 0, pool, settings))
      setFeedback(null)
      setPhase('question')
    },
    [byId, pool, settings],
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
        setQuestion(buildQuestion(card, 0, pool, opts))
        setFeedback(null)
        setPhase('question')
      }
    },
    [byId, cards, pool, settings],
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

  // Resume a saved session once on mount; an answered question continues with the next one.
  useEffect(() => {
    if (!restored) return
    const s = restored.session
    setSession(s)
    if (restored.phase === 'summary' || restored.phase === 'done') {
      setPhase(restored.phase)
      return
    }
    const pos = restored.phase === 'feedback' ? s.pos + 1 : s.pos
    if (pos < s.round.length) ask({ ...s, pos })
    else setPhase(s.order.every((id) => s.stages[id] === 2) ? 'done' : 'summary')
    if (pos !== s.pos) setSession({ ...s, pos })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase === 'setup' || !session) return
    saveProgress(storageKey, { phase, session: { ...session, attempted: [...session.attempted] } } satisfies SavedLearn)
  }, [phase, session, storageKey])

  const resetProgress = () => {
    clearProgress(storageKey)
    setSession(null)
    setQuestion(null)
    setFeedback(null)
    setPhase('setup')
  }

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
        title={starredOnly ? m.learn.titleStarred : m.common.learn}
        subtitle={deck.title}
        actions={
          phase !== 'setup' && (
            <>
              <Button variant="ghost" onClick={() => setResetOpen(true)}>
                {m.common.resetProgress}
              </Button>
              <Button onClick={() => setSettingsOpen(true)}>{m.common.settings}</Button>
            </>
          )
        }
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={m.common.resetProgressTitle}
        description={m.common.resetProgressText}
        confirmLabel={m.common.resetProgress}
        onConfirm={resetProgress}
      />

      {starredOnly && cards.length === 0 ? (
        <Page>
          <EmptyState
            title={m.common.noStarred}
            description={m.learn.noStarredText}
          >
            <Button variant="primary" onClick={() => navigate(`/deck/${deck.id}/learn`, { replace: true })}>
              {m.common.studyAll}
            </Button>
          </EmptyState>
        </Page>
      ) : phase === 'setup' ? (
        <Page>
          <Section title={m.learn.setup}>
            <p className="Muted">{m.learn.setupText}</p>
          </Section>
          <LearnSettingsForm
            settings={settings}
            onChange={setSettings}
            deckId={deck.id}
            starredOnly={starredOnly}
            starredCount={starredCount}
          />
          <div>
            <Button variant="primary" size="lg" onClick={() => start()}>
              {m.learn.start}
            </Button>
          </div>
        </Page>
      ) : phase === 'done' ? (
        <Page>
          <LearnProgress counts={counts} total={cards.length} />
          <Section title={starredOnly ? m.learn.allStarredMastered : m.learn.deckMastered}>
            <p className="Lead">
              {m.learn.masteredIn(pluralCards(cards.length), session?.roundNumber ?? 1)}
            </p>
            <div className="Row">
              <Button variant="primary" onClick={() => start()}>
                {m.learn.again}
              </Button>
              <Button onClick={() => navigate(`/deck/${deck.id}/flashcards${starredOnly ? '/starred' : ''}`)}>
                {m.learn.review}
              </Button>
            </div>
          </Section>
        </Page>
      ) : phase === 'summary' && session ? (
        <Page>
          <LearnProgress counts={counts} total={cards.length} />
          <Section
            title={m.learn.roundEnd(session.roundNumber)}
            actions={
              <Button variant="primary" onClick={continueRound}>
                {m.learn.nextRound}
              </Button>
            }
          >
            <p className="Lead">
              {m.learn.score(session.results.filter((r) => r.correct).length, session.results.length)}
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
                      aria-label={r.correct ? m.common.correct : m.common.wrong}
                    >
                      {r.correct ? '✓' : '✕'}
                    </span>
                    <SideContent side={card.front} />
                    <div className="CardRow-back">
                      <SideContent side={card.back} />
                    </div>
                    <div className="Results-star">
                      <StarToggle starred={stars.isStarred(card.id)} onToggle={() => stars.toggle(card.id)} />
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
            starred={stars.isStarred(question.card.id)}
            onStar={() => stars.toggle(question.card.id)}
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
        title={m.learn.settingsTitle}
        description={m.learn.settingsText}
      >
        <LearnSettingsForm
          settings={settings}
          onChange={applySettings}
          deckId={deck.id}
          starredOnly={starredOnly}
          starredCount={starredCount}
        />
      </Sheet>
    </>
  )
}

function LearnSettingsForm({
  settings,
  onChange,
  deckId,
  starredOnly,
  starredCount,
}: {
  settings: LearnSettings
  onChange: (s: LearnSettings) => void
  deckId: string
  starredOnly: boolean
  starredCount: number
}) {
  const m = useT()
  return (
    <div className="SettingsForm">
      <Switch
        label={m.common.onlyStarred}
        description={starredCount > 0 ? m.learn.onlyStarredText(pluralCards(starredCount)) : m.common.starFirst}
        checked={starredOnly}
        disabled={!starredOnly && starredCount === 0}
        onCheckedChange={(on) => navigate(`/deck/${deckId}/learn${on ? '/starred' : ''}`, { replace: true })}
      />
      <Fieldset legend={m.learn.types}>
        <Segmented<QuestionType>
          label={m.learn.types}
          multiple
          value={settings.types}
          onChange={(types) => onChange({ ...settings, types })}
          options={(['mc', 'tf', 'written'] as const).map((t) => ({ value: t, label: m.learn.typeLabels[t] }))}
        />
      </Fieldset>
      <Fieldset legend={m.learn.answerWith}>
        <Segmented<AnswerWith>
          label={m.learn.answerWith}
          value={[settings.answerWith]}
          onChange={([answerWith]) => onChange({ ...settings, answerWith })}
          options={[
            { value: 'back', label: m.learn.answerBack },
            { value: 'front', label: m.learn.answerFront },
            { value: 'both', label: m.learn.answerBoth },
          ]}
        />
        <p className="Hint">{m.learn.answerHint}</p>
      </Fieldset>
      <Fieldset legend={m.learn.roundSize}>
        <Segmented<string>
          label={m.learn.roundSize}
          value={[String(settings.roundSize)]}
          onChange={([v]) => onChange({ ...settings, roundSize: Number(v) })}
          options={['5', '7', '10', '20'].map((v) => ({ value: v, label: v }))}
        />
      </Fieldset>
      <Switch label={m.common.shuffle} checked={settings.shuffle} onCheckedChange={(shuffle) => onChange({ ...settings, shuffle })} />
    </div>
  )
}

function LearnProgress({ counts, total }: { counts: { new: number; learning: number; mastered: number }; total: number }) {
  const m = useT()
  return (
    <div className="Stack">
      <ProgressBar value={(counts.mastered / Math.max(1, total)) * 100} label={m.learn.mastered} />
      <div className="Stats">
        <span>
          {m.learn.newStat} <strong>{counts.new}</strong>
        </span>
        <span>
          {m.learn.learningStat} <strong>{counts.learning}</strong>
        </span>
        <span>
          {m.learn.masteredStat} <strong>{counts.mastered}</strong>
        </span>
      </div>
    </div>
  )
}

function QuestionView({
  question,
  feedback,
  starred,
  onStar,
  onAnswer,
}: {
  question: Question
  feedback: Feedback | null
  starred: boolean
  onStar: () => void
  onAnswer: (correct: boolean, extra?: Partial<Feedback>) => void
}) {
  const m = useT()
  return (
    <section className="Question">
      <div className="Flashcard-header">
        <h2 className="Flashcard-label">{question.prompt === question.card.front ? m.common.question : m.common.answer}</h2>
        <StarToggle starred={starred} onToggle={onStar} />
      </div>
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
  const m = useT()
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
      <p className="Muted">{question.multi ? m.learn.selectAll : m.learn.chooseOne}</p>
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
                    {result === 'correct' && m.learn.optCorrect}
                    {result === 'missed' && m.learn.optMissed}
                    {result === 'wrong' && m.learn.optWrong}
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
            {m.common.check}
          </Button>
        </div>
      )}
      {!answered && <p className="Hint">{m.learn.keysHint(question.options.length)}</p>}
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
  const m = useT()
  return (
    <div className="Stack">
      <p className="Muted">{m.learn.isCorrect}</p>
      <blockquote className="Candidate">
        <SideContent side={question.candidate} />
      </blockquote>
      <div className="TwoButtons">
        <Button disabled={answered} onClick={() => onAnswer(question.isTrue, { selected: ['true'] })}>
          {m.learn.true}
        </Button>
        <Button disabled={answered} onClick={() => onAnswer(!question.isTrue, { selected: ['false'] })}>
          {m.learn.false}
        </Button>
      </div>
      {answered && <p className="Muted">{m.learn.itIs(question.isTrue)}</p>}
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
  const m = useT()
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
      <Field label={m.learn.typeAnswer}>
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
            {m.common.check}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onAnswer(false, { given: '' })}>
            {m.learn.dontKnow}
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
  const m = useT()
  if (feedback) return null
  if (!revealed) {
    return (
      <div className="Stack">
        <p className="Muted">{m.learn.recall}</p>
        <div>
          <Button variant="primary" onClick={() => setRevealed(true)}>
            {m.learn.showAnswer}
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
      <p className="Muted">{m.learn.didYouKnow}</p>
      <div className="TwoButtons">
        <Button onClick={() => onAnswer(false)}>{m.learn.no}</Button>
        <Button variant="primary" onClick={() => onAnswer(true)}>
          {m.learn.yes}
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
  const m = useT()
  return (
    <aside className="Feedback" role="status" data-correct={feedback.correct}>
      <h3 className="Feedback-title">
        {feedback.correct
          ? feedback.typo
            ? m.learn.fbTypo
            : m.learn.fbCorrect
          : feedback.given === ''
            ? m.learn.fbSkipped
            : m.learn.fbWrong}
      </h3>
      {(!feedback.correct || feedback.typo || question.kind === 'written') && (
        <div className="Feedback-answer">
          <p className="Muted">{m.learn.correctAnswer}</p>
          <SideContent side={question.answer} />
        </div>
      )}
      {question.card.explanation && <Explanation text={question.card.explanation} defaultOpen />}
      <div className="Row">
        <Button variant="primary" onClick={onNext}>
          {m.learn.next}
        </Button>
        {onOverride && (
          <Button variant="ghost" onClick={onOverride}>
            {m.learn.override}
          </Button>
        )}
      </div>
    </aside>
  )
}
