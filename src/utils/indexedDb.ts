// Helper utility for IndexedDB persistent client-side storage with connection pooling & reconnect resilience
const DB_NAME = 'LibraryCatalogAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_key_value';

let cachedDb: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

function getDb(): Promise<IDBDatabase | null> {
  if (cachedDb) {
    return Promise.resolve(cachedDb);
  }
  if (dbOpenPromise) {
    return dbOpenPromise;
  }

  dbOpenPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch (e) {
          console.warn('IndexedDB upgrade warning:', e);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        cachedDb = db;
        db.onclose = () => {
          cachedDb = null;
          dbOpenPromise = null;
        };
        db.onversionchange = () => {
          try {
            db.close();
          } catch (_) {}
          cachedDb = null;
          dbOpenPromise = null;
        };
        resolve(db);
      };

      request.onerror = (err) => {
        console.warn('IndexedDB open error:', err);
        cachedDb = null;
        dbOpenPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked by another connection');
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB initialization error:', e);
      cachedDb = null;
      dbOpenPromise = null;
      resolve(null);
    }
  });

  return dbOpenPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    return await new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          resolve((request.result as T) ?? null);
        };

        request.onerror = () => {
          resolve(null);
        };

        transaction.onerror = () => {
          resolve(null);
        };
      } catch (err: any) {
        if (
          err?.name === 'InvalidStateError' ||
          String(err).toLowerCase().includes('closing') ||
          String(err).toLowerCase().includes('hidden')
        ) {
          cachedDb = null;
          dbOpenPromise = null;
        }
        resolve(null);
      }
    });
  } catch (err) {
    return null;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          resolve();
        };

        transaction.onerror = () => {
          resolve();
        };
      } catch (err: any) {
        if (
          err?.name === 'InvalidStateError' ||
          String(err).toLowerCase().includes('closing') ||
          String(err).toLowerCase().includes('hidden')
        ) {
          cachedDb = null;
          dbOpenPromise = null;
        }
        resolve();
      }
    });
  } catch (err) {
    // Graceful fallback to localStorage
  }
}

export async function idbRemove(key: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          resolve();
        };

        transaction.onerror = () => {
          resolve();
        };
      } catch (err: any) {
        if (
          err?.name === 'InvalidStateError' ||
          String(err).toLowerCase().includes('closing') ||
          String(err).toLowerCase().includes('hidden')
        ) {
          cachedDb = null;
          dbOpenPromise = null;
        }
        resolve();
      }
    });
  } catch (err) {
    // Non-fatal
  }
}
