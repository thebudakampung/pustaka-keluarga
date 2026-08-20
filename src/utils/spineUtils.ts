import { BookRecord } from '../types';

/**
 * Checks if a book record is marked as spine printed either via the `spinePrinted` boolean flag
 * or via status tag strings in its `catatan`.
 */
export function isBookSpinePrinted(b: Partial<BookRecord> | null | undefined): boolean {
  if (!b) return false;
  if (b.spinePrinted === true) return true;
  if (!b.catatan) return false;
  const c = b.catatan.toLowerCase();
  return (
    c.includes('tulang buku telah dicetak') ||
    c.includes('telah diproses untuk cetakan tulang buku') ||
    c.includes('tulang dicetak')
  );
}

/**
 * Thoroughly removes all variations of spine printed tags and note text from a `catatan` string.
 */
export function cleanSpinePrintedCatatan(catatan: string | undefined | null): string {
  if (!catatan) return '';
  return catatan
    // Remove bracketed patterns (handles optional closing bracket, optional spaces, case-insensitive)
    .replace(/\[\s*Tulang Buku Telah Dicetak[^\]]*\]?/gi, '')
    .replace(/\[\s*Telah diproses untuk cetakan tulang buku[^\]]*\]?/gi, '')
    .replace(/\[\s*Tulang Dicetak[^\]]*\]?/gi, '')
    // Remove unbracketed phrases
    .replace(/🏷️\s*Tulang Dicetak/gi, '')
    .replace(/Tulang Buku Telah Dicetak/gi, '')
    .replace(/Telah diproses untuk cetakan tulang buku/gi, '')
    .replace(/Tulang Dicetak/gi, '')
    // Collapse multiple spaces and trim
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts 3 uppercase letters from the author's first name according to library rules:
 * 1. Ignores titles/honorifics (Dr., Prof., Haji, Ustaz, Sayyid, Sheikh, Ir., Dato', Datuk, Datin, Tan Sri, Nik, Wan, Tengku, Raja, Tuan, Puan, Encik, Cik, Sir, Lord, Lady, etc.)
 * 2. Identifies the first name (first word after stripping titles)
 * 3. Extracts first 3 letters in UPPERCASE (e.g. Fathi -> FAT, Dr. Majdi -> MAJ, Ustaz Ashaari -> ASH, Prof. Dr. Kamilin -> KAM)
 */
export function get3LetterAuthorCode(pengarang: string | undefined | null): string {
  if (!pengarang || !pengarang.trim()) return 'UNK';

  let name = pengarang.trim();

  // Strip leading phrases like "Oleh:", "Disusun oleh:", "Editor:", etc.
  name = name.replace(/^(oleh|by|diselenggarakan oleh|disusun oleh|editor:?|penulis:?)\s+/i, '').trim();

  // Honorifics and titles regex to strip from start of name repeatedly
  const titleRegex = /^(prof\.?(esor)?|dr\.?|drs\.?|drh\.?|ph\.?d\.?|m\.?a\.?|haji|hj\.?|hajah|hjh\.?|ustaz|ustazah|ust\.?|sayyid|syed|sharifah|syarifah|sheikh|syeikh|syaikh|shaykh|ir\.?|ts\.?|sr\.?|dato'?|datuk|datin|tan sri|puan sri|tun|toh puan|tunku|tengku|raja|engku|ungku|nik|wan|megat|puteri|tuan guru|tg\.?|tuan|puan|encik|cik|sir|lord|lady|dame|maulana|kiyai|kyai|k\.?h\.?|kh\.?|imam|mufti)\b[\.\s]*/i;

  let previous = '';
  while (name !== previous) {
    previous = name;
    name = name.replace(titleRegex, '').trim();
  }

  // Remove non-alphabetic characters except spaces
  const clean = name.replace(/[^a-zA-Z\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 'UNK';

  // Find the first substantial word (length >= 3) e.g., in "A. Samad Said" -> "Samad" -> "SAM"
  const targetWord = words.find((w) => w.length >= 3) || words[0];

  if (targetWord.length >= 3) {
    return targetWord.substring(0, 3).toUpperCase();
  } else {
    const combined = words.join('');
    if (combined.length >= 3) {
      return combined.substring(0, 3).toUpperCase();
    }
    return combined.padEnd(3, 'X').toUpperCase();
  }
}

/**
 * Separates raw DDC string (e.g. "297.95 ALI" or "297.95") into clean DDC number (e.g. "297.95")
 * and Author Code / Cutter letters (e.g. "ALI").
 */
export function parseDdcAndAuthorCode(noDdc: string | undefined | null, pengarang: string | undefined | null) {
  const rawDdc = (noDdc || '').trim();
  const rawPengarang = (pengarang || '').trim();

  let ddcOnly = rawDdc;
  let authorCode = '';

  if (rawDdc) {
    // Matches e.g. "297.95 ALI", "823.914 ROW", "F KAS"
    const match = rawDdc.match(/^(.*?)\s+([A-Za-z]{1,5})$/);
    if (match) {
      ddcOnly = match[1].trim();
      authorCode = match[2].toUpperCase();
    }
  }

  // ALWAYS enforce the 3-letter first name rule if pengarang is provided!
  if (rawPengarang) {
    const derived = get3LetterAuthorCode(rawPengarang);
    if (derived && derived !== 'UNK') {
      authorCode = derived;
    }
  }

  return {
    ddcOnly: ddcOnly || '-',
    authorCode: authorCode || (rawPengarang ? get3LetterAuthorCode(rawPengarang) : '-'),
  };
}

/**
 * Formats a DDC string to ensure it includes the 3-letter author code derived from author's first name.
 */
export function formatDdcWithAuthorCode(noDdc: string | undefined | null, pengarang: string | undefined | null): string {
  const { ddcOnly } = parseDdcAndAuthorCode(noDdc, pengarang);
  const author3 = get3LetterAuthorCode(pengarang);

  if (ddcOnly && ddcOnly !== '-') {
    if (author3 && author3 !== 'UNK') {
      return `${ddcOnly} ${author3}`;
    }
    return ddcOnly;
  }
  return noDdc || '';
}
