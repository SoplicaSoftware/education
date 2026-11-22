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
        <TopBar back="/" title="Not found" />
        <Page>
          <EmptyState
            title="This deck does not exist"
            description="It may have been deleted or created in another browser. Decks are only saved locally."
          >
            <Button onClick={() => navigate('/')}>Back to all decks</Button>
          </EmptyState>
        </Page>
      </>
    )
  }

  switch (route[2]) {
    case 'edit':
      return <DeckEditor key={deck.id} deck={deck} />
    case 'flashcards':
      return <FlashcardsMode key={`${deck.id}/${route[3]}`} deck={deck} starredOnly={route[3] === 'starred'} />
    case 'learn':
      return <LearnMode key={`${deck.id}/${route[3]}`} deck={deck} starredOnly={route[3] === 'starred'} />
    default:
      return <DeckView deck={deck} />
  }
}
