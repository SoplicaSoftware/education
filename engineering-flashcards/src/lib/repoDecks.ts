import type { Deck } from '../types'
import { parseImportData } from './io'

// Every JSON file in engineering-flashcards/decks/ is bundled at build time as its own lazy chunk.
const files = import.meta.glob<unknown>('../../decks/**/*.json', { import: 'default' })

// Empty folders are kept in git with a .gitkeep so they are listed before they get any decks.
const keeps = import.meta.glob('../../decks/**/.gitkeep', { query: '?raw', import: 'default', exhaustive: true })

const PREFIX = 'repo:'

const relative = (path: string) => path.replace(/^.*\/decks\//, '')
const folderOf = (path: string) => (path.includes('/') ? path.slice(0, path.indexOf('/')) : '')

/** Top-level folders of decks/, e.g. "Fizyka II (lab)". */
export const repoFolders = [...new Set([...Object.keys(files), ...Object.keys(keeps)].map((p) => folderOf(relative(p))))]
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, 'pl'))

export const isRepoDeck = (id: string) => id.startsWith(PREFIX)

/** Path of the source file relative to decks/, e.g. "fizyka.json". */
export const repoDeckFile = (id: string) =>
  `${id.slice(PREFIX.length).replace(/#\d+$/, '').replaceAll('~', '/')}.json`

export const repoDeckFolder = (id: string) => folderOf(repoDeckFile(id))

export async function loadRepoDecks(): Promise<Deck[]> {
  const entries = await Promise.all(
    Object.entries(files).map(async ([path, load]) => {
      const name = relative(path).replace(/\.json$/, '')
      try {
        // Index-based card ids keep stars attached to cards that have no id in the file.
        const decks = parseImportData(await load(), (d, c) => `${name}-${d}-${c}`)
        // Ids come from the file path so routes and local edits survive rebuilds.
        // "/" would split the hash route, so subfolders are joined with "~".
        return decks.map((deck, i) => ({
          ...deck,
          id: `${PREFIX}${name.replaceAll('/', '~')}${decks.length > 1 ? `#${i + 1}` : ''}`,
          createdAt: 0,
          updatedAt: 0,
        }))
      } catch (e) {
        console.error(`Could not load decks/${name}.json`, e)
        return []
      }
    }),
  )
  return entries.flat().sort((a, b) => a.title.localeCompare(b.title, 'pl'))
}
