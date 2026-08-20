import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { BookRecord, LibrarySettings, AuditLog, SpineLabelSettings } from '../types';
import { sanitizeBookForFirestore } from '../utils/imageOptimizer';
import { sortBooks } from '../utils/bookSorting';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Set Firestore log level to error to suppress harmless clock skew warnings
setLogLevel('error');

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with configured database ID
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Validate Connection to Firestore (Skill Guideline)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Authenticate anonymously automatically
let isAuthReady = false;
signInAnonymously(auth).catch((err) => {
  console.warn('Authentication anonymous warning:', err);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    isAuthReady = true;
  }
});

/**
 * Check if an error is network, offline, or quota related
 */
function isNetworkOrOfflineError(err: any): boolean {
  if (!err) return false;
  const code = err?.code || '';
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'resource-exhausted' ||
    code === 'failed-precondition' ||
    code === 'deadline-exceeded' ||
    msg.includes('unavailable') ||
    msg.includes('could not reach cloud firestore') ||
    msg.includes('connection failed') ||
    msg.includes('offline') ||
    msg.includes('quota') ||
    msg.includes('network')
  );
}

/**
 * Clean undefined values to prevent Firestore errors
 */
function sanitize<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data, (_, value) => (value === undefined ? null : value)));
}

/**
 * Subscribe to live books updates from Firestore
 */
export function subscribeToBooks(
  onSuccess: (books: BookRecord[]) => void,
  onError?: (error: Error) => void
) {
  const booksRef = collection(db, 'books');
  return onSnapshot(
    booksRef,
    (snapshot) => {
      const items: BookRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as BookRecord;
        if (data && data.id) {
          items.push(data);
        }
      });
      // Sort by newest recorded timestamp by default
      const sortedItems = sortBooks(items, 'terbaru');
      onSuccess(sortedItems);
    },
    (err) => {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Firestore sedang dalam mod luar talian (offline / fallback tempatan):', err.message || err);
      } else {
        console.error('Error fetching Firestore books:', err);
      }
      if (onError) onError(err);
    }
  );
}

/**
 * Save or update single book in Firestore
 */
export async function saveBookToFirestore(book: BookRecord): Promise<void> {
  if (!book || !book.id) return;
  try {
    const safeBook = await sanitizeBookForFirestore(book);
    const bookRef = doc(db, 'books', safeBook.id);
    const cleanData = sanitize(safeBook);
    await setDoc(bookRef, cleanData, { merge: true });
  } catch (err: any) {
    if (isNetworkOrOfflineError(err)) {
      console.warn(`Firestore simpanan luar talian untuk buku (${book.id}):`, err.message || err);
    } else {
      console.error(`Gagal menyimpan buku (${book.id}) ke Firestore:`, err);
    }
  }
}

/**
 * Batch save multiple books safely (chunked into batches of 100)
 */
export async function saveMultipleBooksToFirestore(books: BookRecord[]): Promise<void> {
  if (!books || books.length === 0) return;
  const chunkSize = 100;
  for (let i = 0; i < books.length; i += chunkSize) {
    const chunk = books.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const book of chunk) {
      if (book && book.id) {
        const safeBook = await sanitizeBookForFirestore(book);
        const bookRef = doc(db, 'books', safeBook.id);
        batch.set(bookRef, sanitize(safeBook), { merge: true });
      }
    }
    try {
      await batch.commit();
    } catch (err: any) {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Firestore simpanan batch dalam mod luar talian:', err.message || err);
      } else {
        console.error('Gagal commit batch ke Firestore:', err);
      }
      // Fallback: Save individually if batch fails
      for (const b of chunk) {
        await saveBookToFirestore(b);
      }
    }
  }
}

/**
 * Delete a book from Firestore
 */
export async function deleteBookFromFirestore(bookId: string): Promise<void> {
  try {
    const bookRef = doc(db, 'books', bookId);
    await deleteDoc(bookRef);
  } catch (err: any) {
    if (isNetworkOrOfflineError(err)) {
      console.warn(`Firestore pemadaman luar talian untuk buku (${bookId}):`, err.message || err);
    } else {
      console.warn(`Gagal memadam buku (${bookId}) dari Firestore:`, err);
    }
  }
}

/**
 * Subscribe to Library Settings
 */
export function subscribeToSettings(
  onSuccess: (settings: LibrarySettings) => void,
  onError?: (error: Error) => void
) {
  const docRef = doc(db, 'settings', 'app_settings');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onSuccess(snapshot.data() as LibrarySettings);
      }
    },
    (err) => {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Firestore settings dalam mod luar talian:', err.message || err);
      } else {
        console.error('Error fetching Firestore settings:', err);
      }
      if (onError) onError(err);
    }
  );
}

/**
 * Save Library Settings to Firestore
 */
export async function saveSettingsToFirestore(settings: LibrarySettings): Promise<void> {
  try {
    const docRef = doc(db, 'settings', 'app_settings');
    await setDoc(docRef, sanitize(settings), { merge: true });
  } catch (err: any) {
    if (isNetworkOrOfflineError(err)) {
      console.warn('Firestore simpanan tetapan dalam mod luar talian:', err.message || err);
    } else {
      console.warn('Gagal menyimpan tetapan ke Firestore:', err);
    }
  }
}

/**
 * Subscribe to Deleted Audit Logs
 */
export function subscribeToDeletedAuditLogs(
  onSuccess: (logs: (AuditLog & { bookTitle: string })[]) => void,
  onError?: (error: Error) => void
) {
  const logsRef = collection(db, 'deletedAuditLogs');
  return onSnapshot(
    logsRef,
    (snapshot) => {
      const items: (AuditLog & { bookTitle: string })[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as AuditLog & { bookTitle: string });
      });
      // Sort newest first
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onSuccess(items);
    },
    (err) => {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Firestore audit logs dalam mod luar talian:', err.message || err);
      } else {
        console.error('Error fetching deleted audit logs:', err);
      }
      if (onError) onError(err);
    }
  );
}

/**
 * Save a deleted audit log to Firestore
 */
export async function addDeletedAuditLogToFirestore(
  log: AuditLog & { bookTitle: string }
): Promise<void> {
  try {
    const logRef = doc(db, 'deletedAuditLogs', log.id);
    await setDoc(logRef, sanitize(log));
  } catch (err: any) {
    if (isNetworkOrOfflineError(err)) {
      console.warn('Firestore audit log disimpan secara luar talian:', err.message || err);
    } else {
      console.warn('Gagal menyimpan audit log ke Firestore:', err);
    }
  }
}

/**
 * Clear all deleted audit logs in Firestore
 */
export async function clearDeletedAuditLogsFromFirestore(): Promise<void> {
  try {
    const logsRef = collection(db, 'deletedAuditLogs');
    const snapshot = await getDocs(logsRef);
    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (err: any) {
    if (isNetworkOrOfflineError(err)) {
      console.warn('Firestore pembersihan audit log dalam mod luar talian:', err.message || err);
    } else {
      console.warn('Gagal membersihkan audit log dari Firestore:', err);
    }
  }
}

/**
 * Subscribe to Spine Label & DDC Settings in Firestore
 */
export function subscribeToSpineLabelSettings(
  onSuccess: (settings: SpineLabelSettings) => void,
  onError?: (error: Error) => void
) {
  const docRef = doc(db, 'settings', 'spine_label');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onSuccess(snapshot.data() as SpineLabelSettings);
      }
    },
    (err) => {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Firestore spine label settings dalam mod luar talian:', err.message || err);
      } else {
        console.error('Error fetching Firestore spine label settings:', err);
      }
      if (onError) onError(err);
    }
  );
}

/**
 * Save Spine Label & DDC Settings to Firestore
 */
export async function saveSpineLabelSettingsToFirestore(
  settings: Partial<SpineLabelSettings>
): Promise<void> {
  try {
    const docRef = doc(db, 'settings', 'spine_label');
    await setDoc(docRef, sanitize(settings), { merge: true });
  } catch (err: any) {
    if (isNetworkOrOfflineError(err)) {
      console.warn('Firestore spine label settings disimpan dalam mod luar talian:', err.message || err);
    } else {
      console.error('Gagal menyimpan tetapan spine label ke Firestore:', err);
    }
  }
}


