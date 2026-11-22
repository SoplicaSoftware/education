import { useRef } from 'react'
import { EmptyState, Page, Section, Spinner, TopBar } from '../components/Layout'
import { Button, ChevronRightIcon, DropdownMenu, PlusIcon, notify } from '../components/ui'
import { downloadDecks, parseImport } from '../lib/io'
import { navigate } from '../lib/router'
import { createSampleDeck } from '../lib/sample'
import { useDecks } from '../lib/store'
import { formatDate, newDeck, pluralCards } from '../lib/utils'

export function DeckList() {
  const { decks, error, saveDeck, importDecks } = useDecks()
  const fileInput = useRef<HTMLInputElement>(null)

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
        ) : (
          <Section title={`Twoje zestawy (${decks.length})`}>
            <ul className="List">
              {decks.map((deck) => (
                <li key={deck.id}>
                  <a className="DeckLink" href={`#/deck/${deck.id}`}>
                    <span className="DeckLink-body">
                      <span className="DeckLink-title">{deck.title || 'Bez tytułu'}</span>
                      {deck.description && <span className="DeckLink-description">{deck.description}</span>}
                      <span className="DeckLink-meta">
                        {pluralCards(deck.cards.length)} · {formatDate(deck.updatedAt)}
                      </span>
                    </span>
                    <ChevronRightIcon className="DeckLink-arrow" />
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </Page>
    </>
  )
}
