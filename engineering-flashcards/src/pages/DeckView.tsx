import { useState } from 'react'
import { EmptyState, Page, TopBar } from '../components/Layout'
import { SideContent } from '../components/RichContent'
import { Button, ConfirmDialog, DropdownMenu, notify } from '../components/ui'
import { downloadDecks } from '../lib/io'
import { navigate } from '../lib/router'
import { useDecks } from '../lib/store'
import { isCardEmpty, pluralCards, studyableCards, uid } from '../lib/utils'
import type { Deck } from '../types'

export function DeckView({ deck }: { deck: Deck }) {
  const { removeDeck, saveDeck } = useDecks()
  const [confirmDelete, setConfirmDelete] = useState(false)
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
            <Button onClick={() => navigate(`/deck/${deck.id}/edit`)}>Edytuj</Button>{' '}
            <DropdownMenu
              label="Więcej"
              items={[
                { label: 'Eksportuj do JSON', onClick: () => downloadDecks([deck]) },
                { label: 'Duplikuj', onClick: duplicate },
                { label: 'Usuń zestaw', onClick: () => setConfirmDelete(true) },
              ]}
            />
          </>
        }
      />
      <Page>
        {deck.description && <p>{deck.description}</p>}

        {playable.length === 0 ? (
          <EmptyState title="Ten zestaw jest pusty" description="Dodaj fiszki z pytaniem i odpowiedzią, aby zacząć naukę.">
            <Button onClick={() => navigate(`/deck/${deck.id}/edit`)}>Dodaj fiszki</Button>
          </EmptyState>
        ) : (
          <section>
            <h2>Tryby</h2>
            <Button onClick={() => navigate(`/deck/${deck.id}/flashcards`)}>Fiszki – odwracaj karty i powtarzaj</Button>{' '}
            <Button onClick={() => navigate(`/deck/${deck.id}/learn`)}>Nauka – pytania wyboru, prawda/fałsz i pisemne</Button>
          </section>
        )}

        {cards.length > 0 && (
          <section>
            <h2>Fiszki w zestawie ({cards.length})</h2>
            <ol>
              {cards.map((card) => {
                const choices = card.choices.filter((ch) => ch.text.trim() || ch.image)
                return (
                  <li key={card.id}>
                    <SideContent side={card.front} />
                    <SideContent side={card.back} />
                    {choices.length > 0 && (
                      <ul>
                        {choices.map((ch) => (
                          <li key={ch.id}>
                            {ch.correct ? '✓' : '✗'} <SideContent side={{ text: ch.text, image: ch.image }} />
                          </li>
                        ))}
                      </ul>
                    )}
                    <hr />
                  </li>
                )
              })}
            </ol>
          </section>
        )}
      </Page>

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
    </>
  )
}
