const DB_NAME = 'choice-and-cosmos'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

export async function getItem<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase()
  return requestToPromise(readStore(db, 'readonly').get(key)) as Promise<T | undefined>
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase()
  await completeWrite(db, (store) => store.put(value, key))
}

export async function deleteItem(key: string): Promise<void> {
  const db = await openDatabase()
  await completeWrite(db, (store) => store.delete(key))
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available'))
  }

  if (dbPromise === null) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }
        request.onsuccess = () => {
          resolve(request.result)
        }
        request.onerror = () => {
          dbPromise = null
          reject(request.error ?? new Error('Failed to open IndexedDB'))
        }
      } catch (error) {
        dbPromise = null
        reject(error instanceof Error ? error : new Error('Failed to open IndexedDB'))
      }
    })
  }

  return dbPromise
}

function readStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

function completeWrite(
  db: IDBDatabase,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const request = run(transaction.objectStore(STORE_NAME))
    const fail = () => {
      reject(request.error ?? transaction.error ?? new Error('IndexedDB request failed'))
    }
    transaction.oncomplete = () => {
      resolve()
    }
    transaction.onabort = fail
    transaction.onerror = fail
    request.onerror = fail
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'))
    }
  })
}
