import { Accordion } from '@base-ui/react/accordion'
import { useRef } from 'react'
import { EmptyState, Page, Section, Spinner, TopBar } from '../components/Layout'
import { Button, ChevronRightIcon, DropdownMenu, PlusIcon, Segmented, StarIcon, notify } from '../components/ui'
import { downloadDecks, parseImport } from '../lib/io'
import { navigate } from '../lib/router'
import { createSampleDeck } from '../lib/sample'
import { useDecks } from '../lib/store'
import { isRepoDeck, repoDeckFile, repoDeckFolder, repoFolders } from '../lib/repoDecks'
import { useStarCounts } from '../lib/stars'
import { formatDate, newDeck, pluralCards } from '../lib/utils'
import type { Deck } from '../types'
import { setLang, t, useLang, useT, type Lang } from '../lib/i18n'

function downloadAiGuide() {
  const { href, file } = t().aiGuide
  const a = document.createElement('a')
  a.href = href
  a.download = file
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function DeckList() {
  const { decks, localIds, error, saveDeck, importDecks } = useDecks()
  const m = useT()
  const lang = useLang()
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
    notify(m.home.exampleAdded)
  }

  const onImport = async (files: FileList | null) => {
    if (!files?.length) return
    try {
      let total = 0
      for (const file of files) {
        const imported = await importDecks(parseImport(await file.text()))
        total += imported.length
      }
      notify(m.home.imported(total))
    } catch (e) {
      notify(m.home.importFailed, e instanceof Error ? e.message : undefined, 'error')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <>
      <TopBar
        title={m.appTitle}
        subtitle={m.home.subtitle}
        actions={
          <>
            <Segmented<Lang>
              label={m.common.language}
              value={[lang]}
              onChange={([next]) => setLang(next)}
              options={[
                { value: 'en', label: 'EN' },
                { value: 'pl', label: 'PL' },
              ]}
            />
            <Button variant="primary" onClick={createDeck}>
              <PlusIcon /> {m.home.newDeck}
            </Button>
            <DropdownMenu
              label={m.common.more}
              items={[
                { label: m.home.importFile, onClick: () => fileInput.current?.click() },
                ...(decks && decks.length > 0 ? [{ label: m.home.exportAll, onClick: () => downloadDecks(decks) }] : []),
                { label: m.home.addExample, onClick: addSample },
                { label: m.home.aiGuideMenu, onClick: downloadAiGuide, separatorBefore: true },
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
          <EmptyState title={m.home.storageError} description={error} />
        ) : decks === null ? (
          <Spinner />
        ) : (
          <>
            {(repoFolders.length > 0 || repoDecks.length > 0) && (
              <Section title={m.home.ready}>
                <ReadyDecks decks={repoDecks} localIds={localIds} />
              </Section>
            )}
            {localDecks.length > 0 ? (
              <Section title={m.home.yourDecks(localDecks.length)}>
                <DeckLinks decks={localDecks} localIds={localIds} />
              </Section>
            ) : (
              <EmptyState
                title={m.home.emptyTitle}
                description={m.home.emptyText}
              >
                <Button variant="primary" onClick={createDeck}>
                  <PlusIcon /> {m.home.newDeck}
                </Button>
                <Button onClick={() => fileInput.current?.click()}>{m.home.importJson}</Button>
                <Button onClick={addSample}>{m.home.exampleDeck}</Button>
              </EmptyState>
            )}
          </>
        )}
        {!error && decks !== null && (
          <section className="AiGuide">
            <div className="AiGuide-text">
              <h2>{m.home.aiTitle}</h2>
              <p className="Muted">{m.home.aiText}</p>
            </div>
            <a className="Button" href={m.aiGuide.href} download={m.aiGuide.file}>
              {m.home.aiDownload}
            </a>
          </section>
        )}
      </Page>
    </>
  )
}

function ReadyDecks({ decks, localIds }: { decks: Deck[]; localIds: Set<string> }) {
  const m = useT()
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
              <span className="Folder-name">{g.folder || m.home.otherFolder}</span>
              <span className="Muted">{m.decks(g.decks.length)}</span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="Collapsible-panel">
            {g.decks.length > 0 ? (
              <DeckLinks decks={g.decks} localIds={localIds} />
            ) : (
              <p className="Folder-empty Muted">{m.home.emptyFolder}</p>
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
  const m = useT()
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
                <span className="DeckLink-title">{deck.title || m.common.untitled}</span>
                {deck.description && <span className="DeckLink-description">{deck.description}</span>}
                <span className="DeckLink-meta">
                  {pluralCards(deck.cards.length)} ·{' '}
                  {repo
                    ? `${repoDeckFile(deck.id).split('/').pop()}${localIds.has(deck.id) ? ` · ${m.home.editedLocally}` : ''}`
                    : formatDate(deck.updatedAt)}
                  {starred > 0 && (
                    <>
                      {' · '}
                      <span className="StarCount">
                        <StarIcon /> {m.star.count(starred)}
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
