/**
 * Sistem Mini Perpustakaan AI - Types & Interfaces
 */

export type BookStatus = 'Draf' | 'Perlu Semakan' | 'Lengkap';

export interface AuditLog {
  id: string;
  bookId: string;
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  source: 'OCR AI' | 'Carian Google Books' | 'Carian Open Library' | 'Cadangan Gemini AI' | 'Semakan Pengguna' | 'Import Pukal';
  user: string;
}

export interface BookRecord {
  id: string;
  noBil: number;
  judul: string;
  pengarang: string;
  tempatTerbit: string;
  penerbit: string;
  tahunTerbit: string;
  isbn: string;
  noDdc: string;
  tarikhDitambah: string;
  status: BookStatus;
  catatan: string;
  nomborPerolehan: string;
  urlGambarKulit?: string;
  urlHalamanHakCipta?: string;
  urlBuku?: string;
  ignoreDuplicate?: boolean;
  spinePrinted?: boolean;
  spinePrintedDate?: string;
  tags?: string[];
  confidenceScores: Record<string, number>;
  detectedLanguage?: string;
  auditTrail: AuditLog[];
}

export interface AISuggestion {
  field: keyof BookRecord | string;
  fieldLabel: string;
  existingValue: string;
  suggestedValue: string;
  source: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface OCRResult {
  judul: string;
  pengarang: string;
  tempatTerbit: string;
  penerbit: string;
  tahunTerbit: string;
  isbn: string;
  noDdc: string;
  urlBuku?: string;
  confidenceScores: Record<string, number>;
  detectedLanguage: string;
}

export interface LibrarySettings {
  namaPerpustakaan: string;
  kodPerpustakaan: string;
  ambangConfidence: number; // e.g. 70% below which is marked as "Perlu Semakan"
  autoDdcSuggestion: boolean;
  temaWarna: 'light' | 'dark' | 'system';
  aiMode: 'jimat' | 'penuh';
}

export interface SpineTemplate {
  id: string;
  name: string;
  labelWidthMm: number;
  labelHeightMm: number;
  spineThicknessMm: number;
  marginTopMm?: number;
  marginLeftMm?: number;
  libraryHeaderTitle: string;
  showLibraryHeader: boolean;
  showDdc: boolean;
  showAuthorCode: boolean;
  showBookTitle: boolean;
  showAccessionNo: boolean;
  showBarcode: boolean;
  showCuttingBorder: boolean;
  lineOrder: string[];
  bgColor: string;
  textColor: string;
  borderStyle: string;
  columnsPerRow: number;
  rowsPerSheet: number;
  gapX: number;
  gapY: number;
  fontSizeHeader: number;
  fontSizeDdc: number;
  fontSizeAuthor: number;
  fontSizeTitle: number;
  fontSizeAccession: number;
  fontFamily: string;
  textAlign: string;
}

export interface DdcRule {
  id: string;
  ddcPrefix: string;
  templateId: string;
}

export interface DdcColorInfo {
  bgColor: string;
  textColor: string;
  label: string;
  shortDesc: string;
}

export interface SpineLabelSettings {
  templates: SpineTemplate[];
  selectedTemplateId: string;
  rules: DdcRule[];
  autoDdcColorEnabled: boolean;
  customDdcColors: Record<string, DdcColorInfo>;
}

