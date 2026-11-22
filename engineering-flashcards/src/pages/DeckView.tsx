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

export function DeckView({ deck }: { deck: Deck }) {
  const { removeDeck, saveDeck, localIds } = useDecks()
  const { isStarred, toggle } = useStars(deck.id)
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
    const copy: Deck = { ...structuredClone(deck), id: uid(), title: `${deck.title} (copy)`, createdAt: Date.now() }
    await saveDeck(copy)
    notify('Deck duplicated')
    navigate(`/deck/${copy.id}`)
  }

  return (
    <>
      <TopBar
        back="/"
        title={deck.title || 'Untitled'}
        subtitle={pluralCards(deck.cards.length)}
        actions={
          <>
            <Button onClick={() => navigate(`/deck/${deck.id}/edit`)}>Edit</Button>
            <DropdownMenu
              label="More"
              items={[
                { label: 'Export to JSON', onClick: () => downloadDecks([deck]) },
                { label: 'Duplicate', onClick: duplicate },
                ...(!fromRepo
                  ? [{ label: 'Delete deck', onClick: () => setConfirmDelete(true), danger: true, separatorBefore: true }]
                  : modified
                    ? [
                        {
                          label: 'Restore repository version',
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
                Deck from <code>decks/{repoDeckFile(deck.id)}</code>.{' '}
                {modified
                  ? 'You have local edits – saved only in this browser.'
                  : 'Edits you make are saved only in this browser.'}
              </p>
            )}
          </div>
        )}

        {playable.length === 0 ? (
          <EmptyState title="This deck is empty" description="Add cards with a question and an answer to start studying.">
            <Button variant="primary" onClick={() => navigate(`/deck/${deck.id}/edit`)}>
              Add cards
            </Button>
          </EmptyState>
        ) : (
          <div className="Stack">
            <div className="Modes">
              <button type="button" className="ModeCard" onClick={() => navigate(`/deck/${deck.id}/flashcards`)}>
                <span className="ModeCard-title">
                  Flashcards <ChevronRightIcon />
                </span>
                <span className="ModeCard-description">Flip cards and repeat the ones you don't know yet.</span>
              </button>
              <button type="button" className="ModeCard" onClick={() => navigate(`/deck/${deck.id}/learn`)}>
                <span className="ModeCard-title">
                  Learn <ChevronRightIcon />
                </span>
                <span className="ModeCard-description">
                  Multiple choice, true/false and written questions until you master the deck.
                </span>
              </button>
            </div>
            {starredPlayable > 0 && (
              <div className="StarredBar">
                <span className="StarCount">
                  <StarIcon /> {starredPlayable} starred
                </span>
                <span className="Muted">Practise only these:</span>
                <Button onClick={() => navigate(`/deck/${deck.id}/flashcards/starred`)}>Flashcards</Button>
                <Button onClick={() => navigate(`/deck/${deck.id}/learn/starred`)}>Learn</Button>
              </div>
            )}
          </div>
        )}

        {cards.length > 0 && (
          <Section
            title={`Cards in this deck (${cards.length})`}
            actions={
              <Segmented
                label="Show cards"
                value={[filter]}
                onChange={([v]) => setFilter(v)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'starred', label: `Starred (${starredCount})` },
                ]}
              />
            }
          >
            {shown.length === 0 ? (
              <p className="Muted">
                No starred cards yet. Tap the star next to a card you want to focus on – it's hard, or it's important.
              </p>
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
                                aria-label={ch.correct ? 'Correct' : 'Wrong'}
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
          title="Restore the repository version?"
          description="Your local edits to this deck will be removed and you'll see it exactly as in the repository file."
          confirmLabel="Restore"
          onConfirm={async () => {
            await removeDeck(deck.id)
            notify('Repository version restored')
          }}
        />
      ) : (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this deck?"
          description={`“${deck.title || 'Untitled'}” will be permanently deleted from this browser. Export it first if you want to keep it.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            navigate('/')
            await removeDeck(deck.id)
            notify('Deck deleted')
          }}
        />
      )}
    </>
  )
}
