import { Accordion } from '@base-ui/react/accordion'
import { useRef } from 'react'
import { EmptyState, Page, Section, Spinner, TopBar } from '../components/Layout'
import { Button, ChevronRightIcon, DropdownMenu, PlusIcon, StarIcon, notify } from '../components/ui'
import { downloadDecks, parseImport } from '../lib/io'
import { navigate } from '../lib/router'
import { createSampleDeck } from '../lib/sample'
import { useDecks } from '../lib/store'
import { isRepoDeck, repoDeckFile, repoDeckFolder, repoFolders } from '../lib/repoDecks'
import { useStarCounts } from '../lib/stars'
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
    notify('Example deck added')
  }

  const onImport = async (files: FileList | null) => {
    if (!files?.length) return
    try {
      let total = 0
      for (const file of files) {
        const imported = await importDecks(parseImport(await file.text()))
        total += imported.length
      }
      notify(total === 1 ? 'Deck imported' : `${total} decks imported`)
    } catch (e) {
      notify('Import failed', e instanceof Error ? e.message : undefined, 'error')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <>
      <TopBar
        title="Engineering flashcards"
        subtitle="Flashcards with LaTeX and images"
        actions={
          <>
            <Button variant="primary" onClick={createDeck}>
              <PlusIcon /> New deck
            </Button>
            <DropdownMenu
              label="More"
              items={[
                { label: 'Import from JSON file', onClick: () => fileInput.current?.click() },
                ...(decks && decks.length > 0 ? [{ label: 'Export all', onClick: () => downloadDecks(decks) }] : []),
                { label: 'Add example deck', onClick: addSample },
                { label: 'Guide for generating flashcards with AI', onClick: downloadAiGuide, separatorBefore: true },
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
          <EmptyState title="Cannot open browser storage" description={error} />
        ) : decks === null ? (
          <Spinner />
        ) : (
          <>
            {(repoFolders.length > 0 || repoDecks.length > 0) && (
              <Section title="Ready-to-use flashcards">
                <ReadyDecks decks={repoDecks} localIds={localIds} />
              </Section>
            )}
            {localDecks.length > 0 ? (
              <Section title={`Your decks (${localDecks.length})`}>
                <DeckLinks decks={localDecks} localIds={localIds} />
              </Section>
            ) : (
              <EmptyState
                title="You have no decks of your own yet"
                description="Create a deck with LaTeX formulas and images, or import a JSON file. Everything is saved locally in this browser."
              >
                <Button variant="primary" onClick={createDeck}>
                  <PlusIcon /> New deck
                </Button>
                <Button onClick={() => fileInput.current?.click()}>Import JSON</Button>
                <Button onClick={addSample}>Example deck</Button>
              </EmptyState>
            )}
          </>
        )}
        {!error && decks !== null && (
          <section className="AiGuide">
            <div className="AiGuide-text">
              <h2>Generate flashcards with AI</h2>
              <p className="Muted">
                Download the guide, paste it into any AI chat together with your notes, and import the JSON file you get
                back.
              </p>
            </div>
            <a className="Button" href={AI_GUIDE} download>
              Download guide (.md)
            </a>
          </section>
        )}
      </Page>
    </>
  )
}

function ReadyDecks({ decks, localIds }: { decks: Deck[]; localIds: Set<string> }) {
  const groups = [
    ...repoFolders.map((folder) => ({ folder, decks: decks.filter((d) => repoDeckFolder(d.id) === folder) })),
    { folder: '', decks: decks.filter((d) => !repoDeckFolder(d.id)) },
  ].filter((g) => g.folder || g.decks.length > 0)

  return (
    <Accordion.Root className="Folders" multiple defaultValue={groups.map((g) => g.folder)}>
      {groups.map((g) => (
        <Accordion.Item key={g.folder} value={g.folder} className="Folder">
          <Accordion.Header className="Folder-header">
            <Accordion.Trigger className="Collapsible-trigger Folder-trigger">
              <ChevronRightIcon className="Collapsible-icon" />
              <FolderIcon />
              <span className="Folder-name">{g.folder || 'Other'}</span>
              <span className="Muted">{g.decks.length === 1 ? '1 deck' : `${g.decks.length} decks`}</span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="Collapsible-panel">
            {g.decks.length > 0 ? (
              <DeckLinks decks={g.decks} localIds={localIds} />
            ) : (
              <p className="Folder-empty Muted">No decks here yet.</p>
            )}
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

function FolderIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.25} aria-hidden>
      <path d="M1.75 3.75h4.5l1.5 1.5h6.5v7h-12.5z" strokeLinejoin="round" />
    </svg>
  )
}

function DeckLinks({ decks, localIds }: { decks: Deck[]; localIds: Set<string> }) {
  const stars = useStarCounts()
  return (
    <ul className="List">
      {decks.map((deck) => {
        const repo = isRepoDeck(deck.id)
        const cardIds = new Set(deck.cards.map((c) => c.id))
        const starred = (stars[deck.id] ?? []).filter((id) => cardIds.has(id)).length
        return (
          <li key={deck.id}>
            <a className="DeckLink" href={`#/deck/${deck.id}`}>
              <span className="DeckLink-body">
                <span className="DeckLink-title">{deck.title || 'Untitled'}</span>
                {deck.description && <span className="DeckLink-description">{deck.description}</span>}
                <span className="DeckLink-meta">
                  {pluralCards(deck.cards.length)} ·{' '}
                  {repo
                    ? `${repoDeckFile(deck.id).split('/').pop()}${localIds.has(deck.id) ? ' · edited locally' : ''}`
                    : formatDate(deck.updatedAt)}
                  {starred > 0 && (
                    <>
                      {' · '}
                      <span className="StarCount">
                        <StarIcon /> {starred} starred
                      </span>
                    </>
                  )}
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
