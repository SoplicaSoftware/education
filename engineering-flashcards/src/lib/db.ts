import type { Deck } from '../types'

// IndexedDB instead of localStorage: base64 images quickly exceed localStorage's ~5 MB quota.
const DB_NAME = 'engineering-flashcards'
const STORE = 'decks'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('Ta przeglądarka nie obsługuje IndexedDB.'))
        return
      }
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Nie udało się otworzyć bazy danych.'))
    })
  }
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = fn(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(request.result)
        tx.onerror = () => reject(tx.error ?? request.error)
        tx.onabort = () => reject(tx.error ?? new Error('Transakcja przerwana.'))
      }),
  )
}

export const getAllDecks = () => run<Deck[]>('readonly', (s) => s.getAll() as IDBRequest<Deck[]>)
export const putDeck = (deck: Deck) => run('readwrite', (s) => s.put(deck)).then(() => undefined)
export const deleteDeck = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined)
