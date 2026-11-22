import { useState } from 'react'
import { EmptyState, Page, Section, TopBar } from '../components/Layout'
import { SideContent } from '../components/RichContent'
import { Button, ChevronRightIcon, ConfirmDialog, DropdownMenu, notify } from '../components/ui'
import { downloadDecks } from '../lib/io'
import { isRepoDeck, repoDeckFile } from '../lib/repoDecks'
import { navigate } from '../lib/router'
import { useDecks } from '../lib/store'
import { isCardEmpty, pluralCards, studyableCards, uid } from '../lib/utils'
import type { Deck } from '../types'

export function DeckView({ deck }: { deck: Deck }) {
  const { removeDeck, saveDeck, localIds } = useDecks()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fromRepo = isRepoDeck(deck.id)
  const modified = fromRepo && localIds.has(deck.id)
  const playable = studyableCards(deck)
  const cards = deck.cards.filter((c) => !isCardEmpty(c))

  const duplicate = async () => {
    const copy: Deck = { ...structuredClone(deck), id: uid(), title: `${deck.title} (kopia)`, createdAt: Date.now() }
    await saveDeck(copy)
    notify('Utworzono kopię zestawu')
    navigate(`/deck/${copy.id}`)
  }

  return (
    <>
      <TopBar
        back="/"
        title={deck.title || 'Bez tytułu'}
        subtitle={pluralCards(deck.cards.length)}
        actions={
          <>
            <Button onClick={() => navigate(`/deck/${deck.id}/edit`)}>Edytuj</Button>
            <DropdownMenu
              label="Więcej"
              items={[
                { label: 'Eksportuj do JSON', onClick: () => downloadDecks([deck]) },
                { label: 'Duplikuj', onClick: duplicate },
                ...(!fromRepo
                  ? [{ label: 'Usuń zestaw', onClick: () => setConfirmDelete(true), danger: true, separatorBefore: true }]
                  : modified
                    ? [
                        {
                          label: 'Przywróć wersję z repozytorium',
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
                Zestaw z pliku <code>decks/{repoDeckFile(deck.id)}</code>.{' '}
                {modified
                  ? 'Masz lokalne zmiany – zapisane tylko w tej przeglądarce.'
                  : 'Zmiany w edytorze zapiszą się tylko w tej przeglądarce.'}
              </p>
            )}
          </div>
        )}

        {playable.length === 0 ? (
          <EmptyState title="Ten zestaw jest pusty" description="Dodaj fiszki z pytaniem i odpowiedzią, aby zacząć naukę.">
            <Button variant="primary" onClick={() => navigate(`/deck/${deck.id}/edit`)}>
              Dodaj fiszki
            </Button>
          </EmptyState>
        ) : (
          <div className="Modes">
            <button type="button" className="ModeCard" onClick={() => navigate(`/deck/${deck.id}/flashcards`)}>
              <span className="ModeCard-title">
                Fiszki <ChevronRightIcon />
              </span>
              <span className="ModeCard-description">Odwracaj karty i powtarzaj te, których jeszcze nie umiesz.</span>
            </button>
            <button type="button" className="ModeCard" onClick={() => navigate(`/deck/${deck.id}/learn`)}>
              <span className="ModeCard-title">
                Nauka <ChevronRightIcon />
              </span>
              <span className="ModeCard-description">Pytania wyboru, prawda/fałsz i pisemne – aż opanujesz cały zestaw.</span>
            </button>
          </div>
        )}

        {cards.length > 0 && (
          <Section title={`Fiszki w zestawie (${cards.length})`}>
            <ol className="List">
              {cards.map((card, i) => {
                const choices = card.choices.filter((ch) => ch.text.trim() || ch.image)
                return (
                  <li key={card.id} className="CardRow">
                    <span className="CardRow-index">{i + 1}</span>
                    <SideContent side={card.front} />
                    <div className="CardRow-back">
                      <SideContent side={card.back} />
                    </div>
                    {choices.length > 0 && (
                      <ul className="CardRow-choices">
                        {choices.map((ch) => (
                          <li key={ch.id}>
                            <span
                              className="Mark"
                              data-correct={ch.correct || undefined}
                              data-wrong={!ch.correct || undefined}
                              aria-label={ch.correct ? 'Poprawna' : 'Błędna'}
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
          </Section>
        )}
      </Page>

      {fromRepo ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Przywrócić wersję z repozytorium?"
          description="Twoje lokalne zmiany w tym zestawie zostaną usunięte i zobaczysz go tak, jak w pliku w repozytorium."
          confirmLabel="Przywróć"
          onConfirm={async () => {
            await removeDeck(deck.id)
            notify('Przywrócono wersję z repozytorium')
          }}
        />
      ) : (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Usunąć zestaw?"
          description={`„${deck.title || 'Bez tytułu'}” zostanie trwale usunięty z tej przeglądarki. Jeśli chcesz go zachować, najpierw go wyeksportuj.`}
          confirmLabel="Usuń"
          onConfirm={async () => {
            navigate('/')
            await removeDeck(deck.id)
            notify('Usunięto zestaw')
          }}
        />
      )}
    </>
  )
}
