import type { Deck } from '../types'
import { parseImportData } from './io'

// Every JSON file in engineering-flashcards/decks/ is bundled at build time as its own lazy chunk.
const files = import.meta.glob<unknown>('../../decks/**/*.json', { import: 'default' })

const PREFIX = 'repo:'

export const isRepoDeck = (id: string) => id.startsWith(PREFIX)

/** Path of the source file relative to decks/, e.g. "fizyka.json". */
export const repoDeckFile = (id: string) =>
  `${id.slice(PREFIX.length).replace(/#\d+$/, '').replaceAll('~', '/')}.json`

export async function loadRepoDecks(): Promise<Deck[]> {
  const entries = await Promise.all(
    Object.entries(files).map(async ([path, load]) => {
      const name = path.replace(/^.*\/decks\//, '').replace(/\.json$/, '')
      try {
        const decks = parseImportData(await load())
        // Ids come from the file path so routes and local edits survive rebuilds.
        // "/" would split the hash route, so subfolders are joined with "~".
        return decks.map((deck, i) => ({
          ...deck,
          id: `${PREFIX}${name.replaceAll('/', '~')}${decks.length > 1 ? `#${i + 1}` : ''}`,
          createdAt: 0,
          updatedAt: 0,
        }))
      } catch (e) {
        console.error(`Nie udało się wczytać decks/${name}.json`, e)
        return []
      }
    }),
  )
  return entries.flat().sort((a, b) => a.title.localeCompare(b.title, 'pl'))
}
