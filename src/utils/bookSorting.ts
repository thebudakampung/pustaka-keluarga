import { BookRecord } from '../types';

export type BookSortOption =
  | 'terbaru' // Terkini Direkod (Default)
  | 'terlama' // Terawal Direkod
  | 'judul_asc' // Judul (A - Z)
  | 'judul_desc' // Judul (Z - A)
  | 'ddc_asc' // No. DDC (Menaik)
  | 'tahun_desc' // Tahun Terbit (Terbaharu)
  | 'pengarang_asc' // Pengarang (A - Z)
  | 'nobil_asc'; // No. Perolehan / Bil Asal

/**
 * Extracts a numeric timestamp (epoch in milliseconds) representing when the book was recorded.
 */
export function getBookRecordedTimestamp(book: BookRecord): number {
  if (!book) return 0;

  // 1. Check book.id for embedded epoch milliseconds (e.g., book-1787220359018, import-1787..., bulk-add-1787...)
  if (book.id) {
    const idMatch = book.id.match(/\d{12,14}/);
    if (idMatch) {
      const num = parseInt(idMatch[0], 10);
      if (!isNaN(num) && num > 1000000000000) {
        return num;
      }
    }
  }

  // 2. Check tarikhDitambah (ISO String or standard Date string)
  if (book.tarikhDitambah) {
    const parsed = Date.parse(book.tarikhDitambah);
    if (!isNaN(parsed) && parsed > 0) {
      // If it's a date-only string like "2026-08-20", add small offset based on noBil or numeric id to maintain stable order
      const tieBreaker = typeof book.noBil === 'number' ? book.noBil % 1000000 : 0;
      return parsed + tieBreaker;
    }
  }

  // 3. Check first or last audit trail log
  if (book.auditTrail && Array.isArray(book.auditTrail) && book.auditTrail.length > 0) {
    for (const log of book.auditTrail) {
      if (log && log.timestamp) {
        const parsed = Date.parse(log.timestamp);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
  }

  // 4. Check if noBil itself is a millisecond timestamp
  if (typeof book.noBil === 'number' && book.noBil > 1000000000000) {
    return book.noBil;
  }

  // 5. Fallback: Base sequence order
  return (book.noBil || 0) * 1000;
}

/**
 * Sorts books array according to selected sort option.
 * Default is 'terbaru' (newest recorded books first).
 */
export function sortBooks(books: BookRecord[], sortBy: BookSortOption = 'terbaru'): BookRecord[] {
  if (!Array.isArray(books)) return [];
  const list = [...books];

  switch (sortBy) {
    case 'terbaru':
      return list.sort((a, b) => getBookRecordedTimestamp(b) - getBookRecordedTimestamp(a));

    case 'terlama':
      return list.sort((a, b) => getBookRecordedTimestamp(a) - getBookRecordedTimestamp(b));

    case 'judul_asc':
      return list.sort((a, b) => (a.judul || '').localeCompare(b.judul || '', 'ms'));

    case 'judul_desc':
      return list.sort((a, b) => (b.judul || '').localeCompare(a.judul || '', 'ms'));

    case 'pengarang_asc':
      return list.sort((a, b) => (a.pengarang || '').localeCompare(b.pengarang || '', 'ms'));

    case 'ddc_asc':
      return list.sort((a, b) => (a.noDdc || '').localeCompare(b.noDdc || '', undefined, { numeric: true }));

    case 'tahun_desc':
      return list.sort((a, b) => {
        const yrA = parseInt(a.tahunTerbit?.match(/\d{4}/)?.[0] || '0', 10);
        const yrB = parseInt(b.tahunTerbit?.match(/\d{4}/)?.[0] || '0', 10);
        return yrB - yrA;
      });

    case 'nobil_asc':
      return list.sort((a, b) => (a.noBil || 0) - (b.noBil || 0));

    default:
      return list.sort((a, b) => getBookRecordedTimestamp(b) - getBookRecordedTimestamp(a));
  }
}

/**
 * Formats the recorded timestamp into a friendly human-readable Malay date/time.
 */
export function formatBookRecordedTime(book: BookRecord): string {
  const ts = getBookRecordedTimestamp(book);
  if (!ts) {
    return book.tarikhDitambah || '-';
  }

  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Hari ini, ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('ms-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return `${dateStr} ${timeStr}`;
}
