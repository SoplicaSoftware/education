import { useState } from 'react'
import { EmptyState, Page, Section, TopBar } from '../components/Layout'
import { SideContent } from '../components/RichContent'
import {
  Button,
  ChevronRightIcon,
  ConfirmDialog,
  DropdownMenu,
  Segmented,
  StarIcon,
  StarToggle,
  notify,
} from '../components/ui'
import { downloadDecks } from '../lib/io'
import { isRepoDeck, repoDeckFile } from '../lib/repoDecks'
import { navigate } from '../lib/router'
import { useStars } from '../lib/stars'
import { useDecks } from '../lib/store'
import { isCardEmpty, pluralCards, studyableCards, uid } from '../lib/utils'
import type { Deck } from '../types'
import { useT } from '../lib/i18n'

export function DeckView({ deck }: { deck: Deck }) {
  const { removeDeck, saveDeck, localIds } = useDecks()
  const { isStarred, toggle } = useStars(deck.id)
  const m = useT()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [filter, setFilter] = useState<'all' | 'starred'>('all')
  const fromRepo = isRepoDeck(deck.id)
  const modified = fromRepo && localIds.has(deck.id)
  const playable = studyableCards(deck)
  const starredPlayable = playable.filter((c) => isStarred(c.id)).length
  const cards = deck.cards.filter((c) => !isCardEmpty(c))
  const starredCount = cards.filter((c) => isStarred(c.id)).length
  const shown = filter === 'starred' ? cards.filter((c) => isStarred(c.id)) : cards

  const duplicate = async () => {
    const copy: Deck = { ...structuredClone(deck), id: uid(), title: `${deck.title} (${m.errors.copy})`, createdAt: Date.now() }
    await saveDeck(copy)
    notify(m.deck.duplicated)
    navigate(`/deck/${copy.id}`)
  }

  return (
    <>
      <TopBar
        back="/"
        title={deck.title || m.common.untitled}
        subtitle={pluralCards(deck.cards.length)}
        actions={
          <>
            <Button onClick={() => navigate(`/deck/${deck.id}/edit`)}>{m.deck.edit}</Button>
            <DropdownMenu
              label={m.common.more}
              items={[
                { label: m.deck.export, onClick: () => downloadDecks([deck]) },
                { label: m.deck.duplicate, onClick: duplicate },
                ...(!fromRepo
                  ? [{ label: m.deck.delete, onClick: () => setConfirmDelete(true), danger: true, separatorBefore: true }]
                  : modified
                    ? [
                        {
                          label: m.deck.restore,
                          onClick: () => setConfirmDelete(true),
                          danger: true,
                          separatorBefore: true,
                        },
                      ]
                    : []),
              ]}
            />
          </>
        }
      />
      <Page>
        {(deck.description || fromRepo) && (
          <div className="Stack">
            {deck.description && <p className="Lead">{deck.description}</p>}
            {fromRepo && (
              <p className="Hint">
                {m.deck.fromRepo} <code>decks/{repoDeckFile(deck.id)}</code>.{' '}
                {modified
                  ? m.deck.localEdits
                  : m.deck.editsLocal}
              </p>
            )}
          </div>
        )}

        {playable.length === 0 ? (
          <EmptyState title={m.deck.emptyTitle} description={m.deck.emptyText}>
            <Button variant="primary" onClick={() => navigate(`/deck/${deck.id}/edit`)}>
              {m.deck.addCards}
            </Button>
          </EmptyState>
        ) : (
          <div className="Stack">
            <div className="Modes">
              <button type="button" className="ModeCard" onClick={() => navigate(`/deck/${deck.id}/flashcards`)}>
                <span className="ModeCard-title">
                  {m.common.flashcards} <ChevronRightIcon />
                </span>
                <span className="ModeCard-description">{m.deck.flashcardsText}</span>
              </button>
              <button type="button" className="ModeCard" onClick={() => navigate(`/deck/${deck.id}/learn`)}>
                <span className="ModeCard-title">
                  {m.common.learn} <ChevronRightIcon />
                </span>
                <span className="ModeCard-description">{m.deck.learnText}</span>
              </button>
            </div>
            {starredPlayable > 0 && (
              <div className="StarredBar">
                <span className="StarCount">
                  <StarIcon /> {m.star.count(starredPlayable)}
                </span>
                <span className="Muted">{m.deck.practiseOnly}</span>
                <Button onClick={() => navigate(`/deck/${deck.id}/flashcards/starred`)}>{m.common.flashcards}</Button>
                <Button onClick={() => navigate(`/deck/${deck.id}/learn/starred`)}>{m.common.learn}</Button>
              </div>
            )}
          </div>
        )}

        {cards.length > 0 && (
          <Section
            title={m.deck.cardsInDeck(cards.length)}
            actions={
              <Segmented
                label={m.deck.showCards}
                value={[filter]}
                onChange={([v]) => setFilter(v)}
                options={[
                  { value: 'all', label: m.deck.all },
                  { value: 'starred', label: m.deck.starred(starredCount) },
                ]}
              />
            }
          >
            {shown.length === 0 ? (
              <p className="Muted">{m.deck.noStarred}</p>
            ) : (
              <ol className="List">
                {shown.map((card) => {
                  const choices = card.choices.filter((ch) => ch.text.trim() || ch.image)
                  return (
                    <li key={card.id} className="CardRow">
                      <span className="CardRow-index">{cards.indexOf(card) + 1}</span>
                      <SideContent side={card.front} />
                      <div className="CardRow-back">
                        <SideContent side={card.back} />
                      </div>
                      <div className="CardRow-star">
                        <StarToggle starred={isStarred(card.id)} onToggle={() => toggle(card.id)} />
                      </div>
                      {choices.length > 0 && (
                        <ul className="CardRow-choices">
                          {choices.map((ch) => (
                            <li key={ch.id}>
                              <span
                                className="Mark"
                                data-correct={ch.correct || undefined}
                                data-wrong={!ch.correct || undefined}
                                aria-label={ch.correct ? m.common.correct : m.common.wrong}
                              >
                                {ch.correct ? '✓' : '✕'}
                              </span>
                              <SideContent side={{ text: ch.text, image: ch.image }} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </Section>
        )}
      </Page>

      {fromRepo ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={m.deck.restoreTitle}
          description={m.deck.restoreText}
          confirmLabel={m.deck.restoreConfirm}
          onConfirm={async () => {
            await removeDeck(deck.id)
            notify(m.deck.restored)
          }}
        />
      ) : (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={m.deck.deleteTitle}
          description={m.deck.deleteText(deck.title || m.common.untitled)}
          confirmLabel={m.deck.deleteConfirm}
          onConfirm={async () => {
            navigate('/')
            await removeDeck(deck.id)
            notify(m.deck.deleted)
          }}
        />
      )}
    </>
  )
}
