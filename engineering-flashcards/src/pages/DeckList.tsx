import { useRef } from 'react'
import { EmptyState, Page, Spinner, TopBar } from '../components/Layout'
import { Button, DropdownMenu, notify } from '../components/ui'
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
            <Button onClick={createDeck}>Nowy zestaw</Button>{' '}
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
            <Button onClick={createDeck}>Nowy zestaw</Button>{' '}
            <Button onClick={() => fileInput.current?.click()}>Importuj JSON</Button>{' '}
            <Button onClick={addSample}>Zestaw przykładowy</Button>
          </EmptyState>
        ) : (
          <section>
            <h2>Twoje zestawy ({decks.length})</h2>
            <ul>
              {decks.map((deck) => (
                <li key={deck.id}>
                  <a href={`#/deck/${deck.id}`}>
                    <strong>{deck.title || 'Bez tytułu'}</strong>
                  </a>
                  {deck.description && <p>{deck.description}</p>}
                  <p>
                    {pluralCards(deck.cards.length)} · {formatDate(deck.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Page>
    </>
  )
}
