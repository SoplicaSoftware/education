import { useRef } from 'react'
import { EmptyState, Page, Section, Spinner, TopBar } from '../components/Layout'
import { Button, ChevronRightIcon, DropdownMenu, PlusIcon, notify } from '../components/ui'
import { downloadDecks, parseImport } from '../lib/io'
import { navigate } from '../lib/router'
import { createSampleDeck } from '../lib/sample'
import { useDecks } from '../lib/store'
import { isRepoDeck, repoDeckFile } from '../lib/repoDecks'
import { formatDate, newDeck, pluralCards } from '../lib/utils'
import type { Deck } from '../types'

const AI_GUIDE = './how-to-create-flashcards.md'

function downloadAiGuide() {
  const a = document.createElement('a')
  a.href = AI_GUIDE
  a.download = 'how-to-create-flashcards.md'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function DeckList() {
  const { decks, localIds, error, saveDeck, importDecks } = useDecks()
  const fileInput = useRef<HTMLInputElement>(null)
  const repoDecks = (decks ?? []).filter((d) => isRepoDeck(d.id))
  const localDecks = (decks ?? []).filter((d) => !isRepoDeck(d.id))

  const createDeck = async () => {
    const deck = newDeck()
    await saveDeck(deck)
    navigate(`/deck/${deck.id}/edit`)
  }

  const addSample = async () => {
    await saveDeck(createSampleDeck())
    notify('Dodano przykładowy zestaw')
  }

  const onImport = async (files: FileList | null) => {
    if (!files?.length) return
    try {
      let total = 0
      for (const file of files) {
        const imported = await importDecks(parseImport(await file.text()))
        total += imported.length
      }
      notify(total === 1 ? 'Zaimportowano zestaw' : `Zaimportowano zestawy: ${total}`)
    } catch (e) {
      notify('Import nie powiódł się', e instanceof Error ? e.message : undefined, 'error')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <>
      <TopBar
        title="Fiszki inżynierskie"
        subtitle="Fiszki z LaTeX i zdjęciami"
        actions={
          <>
            <Button variant="primary" onClick={createDeck}>
              <PlusIcon /> Nowy zestaw
            </Button>
            <DropdownMenu
              label="Więcej"
              items={[
                { label: 'Importuj z pliku JSON', onClick: () => fileInput.current?.click() },
                ...(decks && decks.length > 0 ? [{ label: 'Eksportuj wszystkie', onClick: () => downloadDecks(decks) }] : []),
                { label: 'Dodaj przykładowy zestaw', onClick: addSample },
                { label: 'Instrukcja do generowania fiszek przez AI', onClick: downloadAiGuide, separatorBefore: true },
              ]}
            />
          </>
        }
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        multiple
        hidden
        onChange={(e) => onImport(e.target.files)}
      />
      <Page>
        {error ? (
          <EmptyState title="Nie można otworzyć pamięci przeglądarki" description={error} />
        ) : decks === null ? (
          <Spinner />
        ) : decks.length === 0 ? (
          <>
            <EmptyState
              title="Nie masz jeszcze żadnych zestawów"
              description="Utwórz zestaw fiszek z wzorami w LaTeX i zdjęciami albo zaimportuj plik JSON. Wszystko zapisuje się lokalnie w tej przeglądarce."
            >
              <Button variant="primary" onClick={createDeck}>
                <PlusIcon /> Nowy zestaw
              </Button>
              <Button onClick={() => fileInput.current?.click()}>Importuj JSON</Button>
              <Button onClick={addSample}>Zestaw przykładowy</Button>
            </EmptyState>
            <p className="Hint">
              Pliki JSON wrzucone do folderu <code>engineering-flashcards/decks/</code> w repozytorium pojawią się tutaj
              automatycznie po wdrożeniu.
            </p>
          </>
        ) : (
          <>
            {repoDecks.length > 0 && (
              <Section title={`Z repozytorium (${repoDecks.length})`}>
                <DeckLinks decks={repoDecks} localIds={localIds} />
              </Section>
            )}
            {localDecks.length > 0 && (
              <Section title={`Twoje zestawy (${localDecks.length})`}>
                <DeckLinks decks={localDecks} localIds={localIds} />
              </Section>
            )}
          </>
        )}
        {!error && decks !== null && (
          <section className="AiGuide">
            <div className="AiGuide-text">
              <h2>Wygeneruj fiszki z AI</h2>
              <p className="Muted">
                Pobierz instrukcję, wklej ją do dowolnego czatu AI razem ze swoimi notatkami i zaimportuj otrzymany plik
                JSON.
              </p>
            </div>
            <a className="Button" href={AI_GUIDE} download>
              Pobierz instrukcję (.md)
            </a>
          </section>
        )}
      </Page>
    </>
  )
}

function DeckLinks({ decks, localIds }: { decks: Deck[]; localIds: Set<string> }) {
  return (
    <ul className="List">
      {decks.map((deck) => {
        const repo = isRepoDeck(deck.id)
        return (
          <li key={deck.id}>
            <a className="DeckLink" href={`#/deck/${deck.id}`}>
              <span className="DeckLink-body">
                <span className="DeckLink-title">{deck.title || 'Bez tytułu'}</span>
                {deck.description && <span className="DeckLink-description">{deck.description}</span>}
                <span className="DeckLink-meta">
                  {pluralCards(deck.cards.length)} ·{' '}
                  {repo
                    ? `decks/${repoDeckFile(deck.id)}${localIds.has(deck.id) ? ' · zmieniony lokalnie' : ''}`
                    : formatDate(deck.updatedAt)}
                </span>
              </span>
              <ChevronRightIcon className="DeckLink-arrow" />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
