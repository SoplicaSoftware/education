import { EmptyState, Page, Spinner, TopBar } from './components/Layout'
import { Button } from './components/ui'
import { navigate, useRoute } from './lib/router'
import { useDecks } from './lib/store'
import { DeckEditor } from './pages/DeckEditor'
import { DeckList } from './pages/DeckList'
import { DeckView } from './pages/DeckView'
import { FlashcardsMode } from './pages/FlashcardsMode'
import { LearnMode } from './pages/LearnMode'

export default function App() {
  const route = useRoute()
  const { decks } = useDecks()

  if (route[0] !== 'deck' || !route[1]) return <DeckList />
  if (decks === null) return <Spinner />

  const deck = decks.find((d) => d.id === route[1])
  if (!deck) {
    return (
      <>
        <TopBar back="/" title="Nie znaleziono" />
        <Page>
          <EmptyState
            title="Ten zestaw nie istnieje"
            description="Mógł zostać usunięty albo został utworzony w innej przeglądarce. Zestawy są zapisywane tylko lokalnie."
          >
            <Button onClick={() => navigate('/')}>Wróć do listy</Button>
          </EmptyState>
        </Page>
      </>
    )
  }

  switch (route[2]) {
    case 'edit':
      return <DeckEditor key={deck.id} deck={deck} />
    case 'flashcards':
      return <FlashcardsMode key={deck.id} deck={deck} />
    case 'learn':
      return <LearnMode key={deck.id} deck={deck} />
    default:
      return <DeckView deck={deck} />
  }
}
