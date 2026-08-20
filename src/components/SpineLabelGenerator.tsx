import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Check, Settings2, Sparkles, BookOpen, Eye, X, ArrowUp, ArrowDown, RotateCcw, Trash2, Bookmark, CheckCircle2, Clock, Save, FileText, Download, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { BookRecord, SpineTemplate, DdcRule, DdcColorInfo, SpineLabelSettings } from '../types';
import { isBookSpinePrinted, parseDdcAndAuthorCode, get3LetterAuthorCode } from '../utils/spineUtils';
import { ConfirmModal } from './ConfirmModal';
import { subscribeToSpineLabelSettings, saveSpineLabelSettingsToFirestore } from '../lib/firebase';

export type { SpineTemplate, DdcRule, DdcColorInfo };

export const DDC_COLOR_PALETTE: Record<string, DdcColorInfo> = {
  '000': { bgColor: '#e2e8f0', textColor: '#0f172a', label: '000 Karya Am / Komputer', shortDesc: 'Kelabu' },
  '100': { bgColor: '#38bdf8', textColor: '#0f172a', label: '100 Falsafah & Psikologi', shortDesc: 'Biru Cair' },
  '200': { bgColor: '#10b981', textColor: '#ffffff', label: '200 Agama Islam & Lain', shortDesc: 'Hijau Zamrud / Turkois' },
  '300': { bgColor: '#3b82f6', textColor: '#ffffff', label: '300 Sains Kemasyarakatan', shortDesc: 'Biru' },
  '400': { bgColor: '#f97316', textColor: '#ffffff', label: '400 Bahasa', shortDesc: 'Jingga' },
  '500': { bgColor: '#facc15', textColor: '#0f172a', label: '500 Sains Tulen', shortDesc: 'Kuning' },
  '600': { bgColor: '#84cc16', textColor: '#0f172a', label: '600 Teknologi & Sains Gunaan', shortDesc: 'Hijau Epal' },
  '700': { bgColor: '#ec4899', textColor: '#ffffff', label: '700 Kesenian & Rekreasi', shortDesc: 'Pink / Magenta' },
  '800': { bgColor: '#a855f7', textColor: '#ffffff', label: '800 Kesusasteraan / Sastera', shortDesc: 'Ungu' },
  '900': { bgColor: '#d97706', textColor: '#ffffff', label: '900 Sejarah & Geografi', shortDesc: 'Coklat / Jingga Tua' },
  'lain': { bgColor: '#ef4444', textColor: '#ffffff', label: 'F / Lain-lain (Fiksi)', shortDesc: 'Merah' },
};

const defaultRules: DdcRule[] = [
  {
    id: 'rule-religion',
    ddcPrefix: '2xx',
    templateId: '2xx-agama'
  }
];

const defaultTemplates: SpineTemplate[] = [
  {
    id: 'default',
    name: 'Templat Lalai (Default)',
    labelWidthMm: 55,
    labelHeightMm: 60,
    spineThicknessMm: 23,
    marginTopMm: 10,
    marginLeftMm: 10,
    libraryHeaderTitle: 'PUSTAKA KELUARGA VEDSAPURA',
    showLibraryHeader: true,
    showDdc: true,
    showAuthorCode: true,
    showBookTitle: true,
    showAccessionNo: false,
    showBarcode: false,
    showCuttingBorder: true,
    lineOrder: ['header', 'ddc', 'authorCode', 'title', 'accessionNo', 'barcode'],
    bgColor: '#d4ff00',
    textColor: '#000000',
    borderStyle: 'solid',
    columnsPerRow: 3,
    rowsPerSheet: 7,
    gapX: 5,
    gapY: 5,
    fontSizeHeader: 10,
    fontSizeDdc: 13,
    fontSizeAuthor: 10,
    fontSizeTitle: 10,
    fontSizeAccession: 9,
    fontFamily: 'font-mono',
    textAlign: 'text-center'
  },
  {
    id: '2xx-agama',
    name: 'Templat 2xx (Agama)',
    labelWidthMm: 55,
    labelHeightMm: 60,
    spineThicknessMm: 23,
    marginTopMm: 10,
    marginLeftMm: 10,
    libraryHeaderTitle: 'PUSTAKA AGAMA ISLAM',
    showLibraryHeader: true,
    showDdc: true,
    showAuthorCode: true,
    showBookTitle: true,
    showAccessionNo: true,
    showBarcode: false,
    showCuttingBorder: true,
    lineOrder: ['header', 'ddc', 'authorCode', 'title', 'accessionNo', 'barcode'],
    bgColor: '#10b981', // Elegant emerald green
    textColor: '#ffffff', // White text for nice contrast
    borderStyle: 'solid',
    columnsPerRow: 3,
    rowsPerSheet: 7,
    gapX: 5,
    gapY: 5,
    fontSizeHeader: 10,
    fontSizeDdc: 13,
    fontSizeAuthor: 10,
    fontSizeTitle: 10,
    fontSizeAccession: 9,
    fontFamily: 'font-serif',
    textAlign: 'text-center'
  }
];

interface SpineLabelGeneratorProps {
  books: BookRecord[];
  selectedBook?: BookRecord | null;
  onNavigateCatalog?: () => void;
  onToggleBookSpinePrinted?: (bookId: string, printed: boolean) => void;
  onToggleBulkBookSpinePrinted?: (bookIds: string[], printed: boolean) => void;
  spineExportTagIds?: string[];
  onToggleSpineExportTag?: (bookId: string) => void;
  onToggleBulkSpineExportTags?: (bookIds: string[], select: boolean) => void;
  onClearAllSpineExportTags?: () => void;
  allowDraftSpinePrint?: boolean;
  onToggleAllowDraftSpinePrint?: () => void;
}

export const SpineLabelGenerator: React.FC<SpineLabelGeneratorProps> = ({
  books,
  selectedBook,
  onNavigateCatalog,
  onToggleBookSpinePrinted,
  onToggleBulkBookSpinePrinted,
  spineExportTagIds = [],
  onToggleSpineExportTag,
  onToggleBulkSpineExportTags,
  onClearAllSpineExportTags,
  allowDraftSpinePrint = false,
  onToggleAllowDraftSpinePrint,
}) => {
  const isUntaggableStatus = (status?: string) => {
    if (allowDraftSpinePrint) return false;
    if (!status) return false;
    const s = status.toLowerCase();
    return s === 'draf' || s === 'perlu semakan' || s === 'perlu_semakan';
  };
  const unprintedBooks = books.filter(b => !isBookSpinePrinted(b) && !isUntaggableStatus(b.status));
  const printedBooks = books.filter(b => isBookSpinePrinted(b));
  const [targetBookId, setTargetBookId] = useState<string>(
    selectedBook ? selectedBook.id : books[0]?.id || ''
  );
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [confirmMarkAllCount, setConfirmMarkAllCount] = useState<number | null>(null);
  const [showClearPrintedConfirm, setShowClearPrintedConfirm] = useState(false);

  // Toggle for including already printed books
  const [includePrintedBooks, setIncludePrintedBooks] = useState<boolean>(false);

  // States and hooks for selective DDC category printing (supports multi-category selection e.g. 200 & 900 together)
  const [selectedDdcFilters, setSelectedDdcFilters] = useState<string[]>(['semua']);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [spineStatusFilter, setSpineStatusFilter] = useState<'semua' | 'belum_dicetak' | 'telah_dicetak'>('semua');

  const handleToggleDdcFilter = (key: string) => {
    if (key === 'semua') {
      setSelectedDdcFilters(['semua']);
      return;
    }
    setSelectedDdcFilters(prev => {
      if (prev.includes('semua')) {
        return [key];
      }
      if (prev.includes(key)) {
        const next = prev.filter(k => k !== key);
        return next.length === 0 ? ['semua'] : next;
      } else {
        return [...prev, key];
      }
    });
  };

  // Candidate books for printing:
  // If user tagged specific books in Catalog (spineExportTagIds), respect those exact catalog books.
  const candidateBooks = (spineExportTagIds && spineExportTagIds.length > 0)
    ? books.filter(b => spineExportTagIds.includes(b.id))
    : (includePrintedBooks ? books : unprintedBooks);

  // Automatically enable includePrintedBooks if tagged books contain printed ones
  useEffect(() => {
    if (spineExportTagIds && spineExportTagIds.length > 0) {
      const hasPrintedInTags = books.some(b => spineExportTagIds.includes(b.id) && isBookSpinePrinted(b));
      if (hasPrintedInTags) {
        setIncludePrintedBooks(true);
      }
    }
  }, [spineExportTagIds, books]);

  useEffect(() => {
    setSelectedBookIds(prev => {
      const unprintedCandidateIds = candidateBooks.filter(b => !isBookSpinePrinted(b)).map(b => b.id);

      // If specific books are tagged in catalog, select unprinted tagged books by default
      if (spineExportTagIds && spineExportTagIds.length > 0) {
        const unprintedTagged = candidateBooks.filter(b => !isBookSpinePrinted(b)).map(b => b.id);
        return unprintedTagged.length > 0 ? unprintedTagged : candidateBooks.map(b => b.id);
      }

      if (prev.length === 0) {
        return unprintedCandidateIds;
      }
      const validPrev = prev.filter(id => candidateBooks.some(b => b.id === id));
      return validPrev.length > 0 ? validPrev : unprintedCandidateIds;
    });
  }, [books, spineExportTagIds, includePrintedBooks]);

  const getDdcClassForGenerator = (noDdc: string): string => {
    const clean = (noDdc || '').trim().replace(/^[^0-9]*/, '');
    if (!clean) return 'lain';
    const match = clean.match(/^\d/);
    if (match) {
      return match[0] + '00';
    }
    return 'lain';
  };

  const ddcCategoriesForGenerator = [
    { key: 'semua', label: 'Semua DDC', desc: 'Semua Buku' },
    { key: '000', label: '000', desc: 'Komputer & Karya Am' },
    { key: '100', label: '100', desc: 'Falsafah & Psikologi' },
    { key: '200', label: '200', desc: 'Agama' },
    { key: '300', label: '300', desc: 'Sains Sosial' },
    { key: '400', label: '400', desc: 'Bahasa' },
    { key: '500', label: '500', desc: 'Sains Tulen' },
    { key: '600', label: '600', desc: 'Teknologi' },
    { key: '700', label: '700', desc: 'Kesenian & Rekreasi' },
    { key: '800', label: '800', desc: 'Kesusasteraan' },
    { key: '900', label: '900', desc: 'Sejarah & Geografi' },
    { key: 'lain', label: 'Lain / Fiksi', desc: 'Fiksi & Lain-lain' },
  ];

  const filteredUnprintedBooks = candidateBooks.filter(b => {
    const matchesDdc = selectedDdcFilters.includes('semua') || selectedDdcFilters.includes(getDdcClassForGenerator(b.noDdc));
    const printed = isBookSpinePrinted(b);
    if (spineStatusFilter === 'belum_dicetak') {
      return matchesDdc && !printed;
    }
    if (spineStatusFilter === 'telah_dicetak') {
      return matchesDdc && printed;
    }
    return matchesDdc;
  });

  const booksToPrint = candidateBooks.filter(b => {
    const isSelected = selectedBookIds.includes(b.id);
    const matchesDdc = selectedDdcFilters.includes('semua') || selectedDdcFilters.includes(getDdcClassForGenerator(b.noDdc));
    return isSelected && matchesDdc;
  });

  // Template lists & settings state
  const [templates, setTemplates] = useState<SpineTemplate[]>(() => {
    const saved = localStorage.getItem('spine_label_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return defaultTemplates;
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    return localStorage.getItem('spine_label_selected_template_id') || 'default';
  });

  const [rules, setRules] = useState<DdcRule[]>(() => {
    const saved = localStorage.getItem('spine_label_ddc_rules');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return defaultRules;
  });

  // Auto DDC Category Color Recognition state
  const [autoDdcColorEnabled, setAutoDdcColorEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('spine_label_auto_ddc_color');
    return saved !== null ? saved === 'true' : true;
  });
  const [showDdcColorSettings, setShowDdcColorSettings] = useState<boolean>(false);

  // Custom DDC Colors state
  const [customDdcColors, setCustomDdcColors] = useState<Record<string, DdcColorInfo>>(() => {
    const saved = localStorage.getItem('spine_label_custom_ddc_colors');
    if (saved) {
      try {
        return { ...DDC_COLOR_PALETTE, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse saved custom DDC colors', e);
      }
    }
    return DDC_COLOR_PALETTE;
  });

  const isSwitchingRef = useRef(false);
  const isRemoteLoadingRef = useRef(false);
  const [firebaseSyncStatus, setFirebaseSyncStatus] = useState<'synced' | 'saving' | 'offline'>('synced');

  // Subscribe to Firebase Firestore for real-time template & DDC rules updates
  useEffect(() => {
    const unsubscribe = subscribeToSpineLabelSettings(
      (remote) => {
        if (remote) {
          isRemoteLoadingRef.current = true;
          if (Array.isArray(remote.templates) && remote.templates.length > 0) {
            setTemplates(remote.templates);
            localStorage.setItem('spine_label_templates', JSON.stringify(remote.templates));
          }
          if (remote.selectedTemplateId) {
            setSelectedTemplateId(remote.selectedTemplateId);
            localStorage.setItem('spine_label_selected_template_id', remote.selectedTemplateId);
          }
          if (Array.isArray(remote.rules)) {
            setRules(remote.rules);
            localStorage.setItem('spine_label_ddc_rules', JSON.stringify(remote.rules));
          }
          if (typeof remote.autoDdcColorEnabled === 'boolean') {
            setAutoDdcColorEnabled(remote.autoDdcColorEnabled);
            localStorage.setItem('spine_label_auto_ddc_color', String(remote.autoDdcColorEnabled));
          }
          if (remote.customDdcColors && Object.keys(remote.customDdcColors).length > 0) {
            setCustomDdcColors(remote.customDdcColors);
            localStorage.setItem('spine_label_custom_ddc_colors', JSON.stringify(remote.customDdcColors));
          }
          setFirebaseSyncStatus('synced');
          setTimeout(() => {
            isRemoteLoadingRef.current = false;
          }, 150);
        }
      },
      (err) => {
        console.warn('Gagal muat tetapan templat daripada Firebase:', err);
        setFirebaseSyncStatus('offline');
      }
    );
    return () => unsubscribe();
  }, []);

  // Auto-save templates & DDC rules to Firebase whenever local state changes
  useEffect(() => {
    if (isRemoteLoadingRef.current) return;
    setFirebaseSyncStatus('saving');
    saveSpineLabelSettingsToFirestore({
      templates,
      selectedTemplateId,
      rules,
      autoDdcColorEnabled,
      customDdcColors
    }).then(() => {
      setFirebaseSyncStatus('synced');
    }).catch(() => {
      setFirebaseSyncStatus('offline');
    });
  }, [templates, selectedTemplateId, rules, autoDdcColorEnabled, customDdcColors]);

  // Custom confirmation & error states to avoid iframe-unfriendly confirm() & alert()
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);
  const [showTemplateDeleteConfirm, setShowTemplateDeleteConfirm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [clearPasswordInput, setClearPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [passwordActionTarget, setPasswordActionTarget] = useState<'clear_printed' | 'ddc_colors'>('clear_printed');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const handleExportSettings = (format: 'xlsx' | 'csv') => {
    const mainSettingsData = [
      { Kategori: 'Ukuran Fizikal Label', Parameter: 'labelWidthMm', Nilai: labelWidthMm, Penerangan: 'Lebar Label (mm)' },
      { Kategori: 'Ukuran Fizikal Label', Parameter: 'labelHeightMm', Nilai: labelHeightMm, Penerangan: 'Tinggi Label (mm)' },
      { Kategori: 'Ukuran Fizikal Label', Parameter: 'spineThicknessMm', Nilai: spineThicknessMm, Penerangan: 'Ketebalan Tulang (mm)' },
      { Kategori: 'Ukuran Fizikal Label', Parameter: 'marginTopMm', Nilai: marginTopMm, Penerangan: 'Margin Atas (mm)' },
      { Kategori: 'Ukuran Fizikal Label', Parameter: 'marginLeftMm', Nilai: marginLeftMm, Penerangan: 'Margin Kiri (mm)' },

      { Kategori: 'Tetapan Helaian Stiker A4', Parameter: 'columnsPerRow', Nilai: columnsPerRow, Penerangan: 'Kolom Setiap Baris' },
      { Kategori: 'Tetapan Helaian Stiker A4', Parameter: 'rowsPerSheet', Nilai: rowsPerSheet, Penerangan: 'Baris Setiap Helaian' },
      { Kategori: 'Tetapan Helaian Stiker A4', Parameter: 'gapX', Nilai: gapX, Penerangan: 'Jarak X Antara Label (mm)' },
      { Kategori: 'Tetapan Helaian Stiker A4', Parameter: 'gapY', Nilai: gapY, Penerangan: 'Jarak Y Antara Label (mm)' },

      { Kategori: 'Medan & Kandungan', Parameter: 'libraryHeaderTitle', Nilai: libraryHeaderTitle, Penerangan: 'Tajuk Perpustakaan / Header' },
      { Kategori: 'Medan & Kandungan', Parameter: 'showLibraryHeader', Nilai: showLibraryHeader ? 'YA' : 'TIDAK', Penerangan: 'Papar Header Perpustakaan' },
      { Kategori: 'Medan & Kandungan', Parameter: 'showDdc', Nilai: showDdc ? 'YA' : 'TIDAK', Penerangan: 'Papar Nombor DDC' },
      { Kategori: 'Medan & Kandungan', Parameter: 'showAuthorCode', Nilai: showAuthorCode ? 'YA' : 'TIDAK', Penerangan: 'Papar Kod Pengarang' },
      { Kategori: 'Medan & Kandungan', Parameter: 'showBookTitle', Nilai: showBookTitle ? 'YA' : 'TIDAK', Penerangan: 'Papar Tajuk Buku' },
      { Kategori: 'Medan & Kandungan', Parameter: 'showAccessionNo', Nilai: showAccessionNo ? 'YA' : 'TIDAK', Penerangan: 'Papar No Perolehan' },
      { Kategori: 'Medan & Kandungan', Parameter: 'showBarcode', Nilai: showBarcode ? 'YA' : 'TIDAK', Penerangan: 'Papar Kod Bar / Barcode' },
      { Kategori: 'Medan & Kandungan', Parameter: 'showCuttingBorder', Nilai: showCuttingBorder ? 'YA' : 'TIDAK', Penerangan: 'Papar Sempadan Garisan Potong' },
      { Kategori: 'Medan & Kandungan', Parameter: 'lineOrder', Nilai: Array.isArray(lineOrder) ? lineOrder.join(',') : lineOrder, Penerangan: 'Susunan Medan Tulang' },

      { Kategori: 'Warna & Sempadan', Parameter: 'bgColor', Nilai: bgColor, Penerangan: 'Warna Latar Label (HEX)' },
      { Kategori: 'Warna & Sempadan', Parameter: 'textColor', Nilai: textColor, Penerangan: 'Warna Teks (HEX)' },
      { Kategori: 'Warna & Sempadan', Parameter: 'borderStyle', Nilai: borderStyle, Penerangan: 'Stail Sempadan' },
      { Kategori: 'Warna & Sempadan', Parameter: 'textAlign', Nilai: textAlign, Penerangan: 'Rataan Teks' },

      { Kategori: 'Saiz Fon & Tipografi', Parameter: 'fontFamily', Nilai: fontFamily, Penerangan: 'Jenis Fon' },
      { Kategori: 'Saiz Fon & Tipografi', Parameter: 'fontSizeHeader', Nilai: fontSizeHeader, Penerangan: 'Saiz Fon Header (pt)' },
      { Kategori: 'Saiz Fon & Tipografi', Parameter: 'fontSizeDdc', Nilai: fontSizeDdc, Penerangan: 'Saiz Fon DDC (pt)' },
      { Kategori: 'Saiz Fon & Tipografi', Parameter: 'fontSizeAuthor', Nilai: fontSizeAuthor, Penerangan: 'Saiz Fon Kod Pengarang (pt)' },
      { Kategori: 'Saiz Fon & Tipografi', Parameter: 'fontSizeTitle', Nilai: fontSizeTitle, Penerangan: 'Saiz Fon Tajuk Buku (pt)' },
      { Kategori: 'Saiz Fon & Tipografi', Parameter: 'fontSizeAccession', Nilai: fontSizeAccession, Penerangan: 'Saiz Fon No Perolehan (pt)' },

      { Kategori: 'Peraturan & Warna DDC', Parameter: 'autoDdcColorEnabled', Nilai: autoDdcColorEnabled ? 'YA' : 'TIDAK', Penerangan: 'Warna DDC Automatik' },
    ];

    Object.entries(customDdcColors).forEach(([code, colorObj]) => {
      const cObj = colorObj as DdcColorInfo;
      mainSettingsData.push({
        Kategori: 'Warna DDC Kebiasaan',
        Parameter: `customDdcColor_${code}`,
        Nilai: `${cObj.bgColor}|${cObj.textColor}`,
        Penerangan: `Warna DDC Kelas ${code} (${cObj.label || code})`
      });
    });

    const wb = XLSX.utils.book_new();
    const wsMain = XLSX.utils.json_to_sheet(mainSettingsData);
    XLSX.utils.book_append_sheet(wb, wsMain, 'Tetapan_Label');

    if (format === 'csv') {
      XLSX.writeFile(wb, 'tetapan_label_tulang_buku.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, 'tetapan_label_tulang_buku.xlsx', { bookType: 'xlsx' });
    }
  };

  const handleImportSettings = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        alert('Fail tidak mempunyai helaian data yang sah.');
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<any>(worksheet);

      let updatedCustomDdc: Record<string, DdcColorInfo> = { ...customDdcColors };
      let importedCount = 0;

      rows.forEach((row: any) => {
        const param = row.Parameter || row.parameter || row.Key || row.key || row.Nama;
        const value = row.Nilai !== undefined ? row.Nilai : (row.nilai !== undefined ? row.nilai : row.Value);

        if (!param || value === undefined) return;

        importedCount++;
        const strVal = String(value).trim();
        const numVal = Number(value);
        const isBoolTrue = strVal.toUpperCase() === 'YA' || strVal.toLowerCase() === 'true' || value === true || strVal === '1';

        switch (param) {
          case 'labelWidthMm': if (!isNaN(numVal)) setLabelWidthMm(numVal); break;
          case 'labelHeightMm': if (!isNaN(numVal)) setLabelHeightMm(numVal); break;
          case 'spineThicknessMm': if (!isNaN(numVal)) setSpineThicknessMm(numVal); break;
          case 'marginTopMm': if (!isNaN(numVal)) setMarginTopMm(numVal); break;
          case 'marginLeftMm': if (!isNaN(numVal)) setMarginLeftMm(numVal); break;

          case 'columnsPerRow': if (!isNaN(numVal)) setColumnsPerRow(numVal); break;
          case 'rowsPerSheet': if (!isNaN(numVal)) setRowsPerSheet(numVal); break;
          case 'gapX': if (!isNaN(numVal)) setGapX(numVal); break;
          case 'gapY': if (!isNaN(numVal)) setGapY(numVal); break;

          case 'libraryHeaderTitle': setLibraryHeaderTitle(strVal); break;
          case 'showLibraryHeader': setShowLibraryHeader(isBoolTrue); break;
          case 'showDdc': setShowDdc(isBoolTrue); break;
          case 'showAuthorCode': setShowAuthorCode(isBoolTrue); break;
          case 'showBookTitle': setShowBookTitle(isBoolTrue); break;
          case 'showAccessionNo': setShowAccessionNo(isBoolTrue); break;
          case 'showBarcode': setShowBarcode(isBoolTrue); break;
          case 'showCuttingBorder': setShowCuttingBorder(isBoolTrue); break;
          case 'lineOrder':
            if (strVal) {
              const parts = strVal.split(',').map(s => s.trim()).filter(Boolean);
              if (parts.length > 0) setLineOrder(parts);
            }
            break;

          case 'bgColor': setBgColor(strVal); break;
          case 'textColor': setTextColor(strVal); break;
          case 'borderStyle': setBorderStyle(strVal); break;
          case 'textAlign': setTextAlign(strVal); break;
          case 'fontFamily': setFontFamily(strVal); break;
          case 'fontSizeHeader': if (!isNaN(numVal)) setFontSizeHeader(numVal); break;
          case 'fontSizeDdc': if (!isNaN(numVal)) setFontSizeDdc(numVal); break;
          case 'fontSizeAuthor': if (!isNaN(numVal)) setFontSizeAuthor(numVal); break;
          case 'fontSizeTitle': if (!isNaN(numVal)) setFontSizeTitle(numVal); break;
          case 'fontSizeAccession': if (!isNaN(numVal)) setFontSizeAccession(numVal); break;
          case 'autoDdcColorEnabled': setAutoDdcColorEnabled(isBoolTrue); break;

          default:
            if (param.startsWith('customDdcColor_')) {
              const code = param.replace('customDdcColor_', '');
              const [bgC, textC] = strVal.split('|');
              if (bgC) {
                updatedCustomDdc[code] = {
                  ...(updatedCustomDdc[code] || DDC_COLOR_PALETTE[code] || { label: code, shortDesc: '', bgColor: bgC, textColor: textC || '#ffffff' }),
                  bgColor: bgC,
                  textColor: textC || '#ffffff'
                };
              }
            }
            break;
        }
      });

      setCustomDdcColors(updatedCustomDdc);
      setImportSuccessMsg(`✓ Berjaya mengimport ${importedCount} tetapan daripada fail "${file.name}"! Sila klik 'Simpan Tetapan Label' untuk menetapkan simpanan Firestore & tempatan.`);
      setTimeout(() => setImportSuccessMsg(null), 7000);
    } catch (err) {
      console.error('Gagal membaca fail tetapan:', err);
      alert('Gagal membaca fail CSV/XLSX. Sila pastikan format fail adalah betul.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportSettings(file);
      e.target.value = '';
    }
  };

  const handleSaveAllSettings = async () => {
    const updatedTemplates = templates.map(t => {
      if (t.id === selectedTemplateId) {
        return {
          ...t,
          labelWidthMm,
          labelHeightMm,
          spineThicknessMm,
          marginTopMm,
          marginLeftMm,
          libraryHeaderTitle,
          showLibraryHeader,
          showDdc,
          showAuthorCode,
          showBookTitle,
          showAccessionNo,
          showBarcode,
          showCuttingBorder,
          lineOrder,
          bgColor,
          textColor,
          borderStyle,
          columnsPerRow,
          rowsPerSheet,
          gapX,
          gapY,
          fontSizeHeader,
          fontSizeDdc,
          fontSizeAuthor,
          fontSizeTitle,
          fontSizeAccession,
          fontFamily,
          textAlign,
        };
      }
      return t;
    });

    setTemplates(updatedTemplates);

    localStorage.setItem('spine_label_templates', JSON.stringify(updatedTemplates));
    localStorage.setItem('spine_label_selected_template_id', selectedTemplateId);
    localStorage.setItem('spine_label_ddc_rules', JSON.stringify(rules));
    localStorage.setItem('spine_label_auto_ddc_color', String(autoDdcColorEnabled));
    localStorage.setItem('spine_label_custom_ddc_colors', JSON.stringify(customDdcColors));

    setFirebaseSyncStatus('saving');
    try {
      await saveSpineLabelSettingsToFirestore({
        templates: updatedTemplates,
        selectedTemplateId,
        rules,
        autoDdcColorEnabled,
        customDdcColors,
      });
      setFirebaseSyncStatus('synced');
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 4000);
    } catch (err) {
      console.warn('Gagal simpan tetapan spine label ke Firestore:', err);
      setFirebaseSyncStatus('offline');
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 4000);
    }
  };

  useEffect(() => {
    localStorage.setItem('spine_label_auto_ddc_color', String(autoDdcColorEnabled));
  }, [autoDdcColorEnabled]);

  useEffect(() => {
    localStorage.setItem('spine_label_custom_ddc_colors', JSON.stringify(customDdcColors));
  }, [customDdcColors]);

  const handleUpdateDdcColor = (key: string, field: 'bgColor' | 'textColor', value: string) => {
    setCustomDdcColors(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || DDC_COLOR_PALETTE[key] || { label: key, shortDesc: '', bgColor: '#ffffff', textColor: '#000000' }),
        [field]: value
      }
    }));
  };

  const handleResetDdcColors = () => {
    setCustomDdcColors(DDC_COLOR_PALETTE);
    localStorage.removeItem('spine_label_custom_ddc_colors');
  };

  useEffect(() => {
    if (ruleError) {
      const timer = setTimeout(() => {
        setRuleError(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [ruleError]);

  // Physical label settings (mm)
  const [labelWidthMm, setLabelWidthMm] = useState<number>(55);
  const [labelHeightMm, setLabelHeightMm] = useState<number>(60);
  const [spineThicknessMm, setSpineThicknessMm] = useState<number>(23);

  // Content & Header Options
  const [libraryHeaderTitle, setLibraryHeaderTitle] = useState<string>('PUSTAKA KELUARGA VEDSAPURA');
  const [showLibraryHeader, setShowLibraryHeader] = useState<boolean>(true);
  const [showDdc, setShowDdc] = useState<boolean>(true);
  const [showAuthorCode, setShowAuthorCode] = useState<boolean>(false);
  const [showBookTitle, setShowBookTitle] = useState<boolean>(true);
  const [showAccessionNo, setShowAccessionNo] = useState<boolean>(false);
  const [showBarcode, setShowBarcode] = useState<boolean>(false);
  const [showCuttingBorder, setShowCuttingBorder] = useState<boolean>(true);

  // Row order lines
  const [lineOrder, setLineOrder] = useState<string[]>([
    'header',
    'ddc',
    'authorCode',
    'title',
    'accessionNo',
    'barcode'
  ]);

  // Color & Border Style
  const [bgColor, setBgColor] = useState<string>('#d4ff00'); // lime yellow/green
  const [textColor, setTextColor] = useState<string>('#000000');
  const [borderStyle, setBorderStyle] = useState<string>('solid');

  // A4 Grid Sheet Settings
  const [columnsPerRow, setColumnsPerRow] = useState<number>(3);
  const [rowsPerSheet, setRowsPerSheet] = useState<number>(7);
  const [gapX, setGapX] = useState<number>(5);
  const [gapY, setGapY] = useState<number>(5);
  const [marginTopMm, setMarginTopMm] = useState<number>(10);
  const [marginLeftMm, setMarginLeftMm] = useState<number>(10);

  // Font Sizes (pt) & Typography
  const [fontSizeHeader, setFontSizeHeader] = useState<number>(10);
  const [fontSizeDdc, setFontSizeDdc] = useState<number>(13);
  const [fontSizeAuthor, setFontSizeAuthor] = useState<number>(10);
  const [fontSizeTitle, setFontSizeTitle] = useState<number>(10);
  const [fontSizeAccession, setFontSizeAccession] = useState<number>(9);
  const [fontFamily, setFontFamily] = useState<string>('font-mono');
  const [textAlign, setTextAlign] = useState<string>('text-center');

  // Load selected template values into active states
  useEffect(() => {
    const activeT = templates.find(t => t.id === selectedTemplateId);
    if (activeT) {
      isSwitchingRef.current = true;
      setLabelWidthMm(activeT.labelWidthMm);
      setLabelHeightMm(activeT.labelHeightMm);
      setSpineThicknessMm(activeT.spineThicknessMm);
      setMarginTopMm(activeT.marginTopMm ?? 10);
      setMarginLeftMm(activeT.marginLeftMm ?? 10);
      setLibraryHeaderTitle(activeT.libraryHeaderTitle);
      setShowLibraryHeader(activeT.showLibraryHeader);
      setShowDdc(activeT.showDdc);
      setShowAuthorCode(activeT.showAuthorCode);
      setShowBookTitle(activeT.showBookTitle);
      setShowAccessionNo(activeT.showAccessionNo);
      setShowBarcode(activeT.showBarcode);
      setShowCuttingBorder(activeT.showCuttingBorder);
      setLineOrder(activeT.lineOrder);
      setBgColor(activeT.bgColor);
      setTextColor(activeT.textColor);
      setBorderStyle(activeT.borderStyle);
      setColumnsPerRow(activeT.columnsPerRow);
      setRowsPerSheet(activeT.rowsPerSheet);
      setGapX(activeT.gapX);
      setGapY(activeT.gapY);
      setFontSizeHeader(activeT.fontSizeHeader);
      setFontSizeDdc(activeT.fontSizeDdc);
      setFontSizeAuthor(activeT.fontSizeAuthor);
      setFontSizeTitle(activeT.fontSizeTitle);
      setFontSizeAccession(activeT.fontSizeAccession);
      setFontFamily(activeT.fontFamily);
      setTextAlign(activeT.textAlign);
      
      // Delay resetting to ensure rendering state catches up
      setTimeout(() => {
        isSwitchingRef.current = false;
      }, 50);
    }
  }, [selectedTemplateId]);

  // Reactive Autosave: Update templates whenever active settings are tweaked
  useEffect(() => {
    if (isSwitchingRef.current) return;
    const activeT = templates.find(t => t.id === selectedTemplateId);
    if (!activeT) return;

    const hasDiff =
      activeT.labelWidthMm !== labelWidthMm ||
      activeT.labelHeightMm !== labelHeightMm ||
      activeT.spineThicknessMm !== spineThicknessMm ||
      activeT.marginTopMm !== marginTopMm ||
      activeT.marginLeftMm !== marginLeftMm ||
      activeT.libraryHeaderTitle !== libraryHeaderTitle ||
      activeT.showLibraryHeader !== showLibraryHeader ||
      activeT.showDdc !== showDdc ||
      activeT.showAuthorCode !== showAuthorCode ||
      activeT.showBookTitle !== showBookTitle ||
      activeT.showAccessionNo !== showAccessionNo ||
      activeT.showBarcode !== showBarcode ||
      activeT.showCuttingBorder !== showCuttingBorder ||
      JSON.stringify(activeT.lineOrder) !== JSON.stringify(lineOrder) ||
      activeT.bgColor !== bgColor ||
      activeT.textColor !== textColor ||
      activeT.borderStyle !== borderStyle ||
      activeT.columnsPerRow !== columnsPerRow ||
      activeT.rowsPerSheet !== rowsPerSheet ||
      activeT.gapX !== gapX ||
      activeT.gapY !== gapY ||
      activeT.fontSizeHeader !== fontSizeHeader ||
      activeT.fontSizeDdc !== fontSizeDdc ||
      activeT.fontSizeAuthor !== fontSizeAuthor ||
      activeT.fontSizeTitle !== fontSizeTitle ||
      activeT.fontSizeAccession !== fontSizeAccession ||
      activeT.fontFamily !== fontFamily ||
      activeT.textAlign !== textAlign;

    if (hasDiff) {
      setTemplates(prev => {
        const updated = prev.map(t => {
          if (t.id === selectedTemplateId) {
            return {
              ...t,
              labelWidthMm,
              labelHeightMm,
              spineThicknessMm,
              marginTopMm,
              marginLeftMm,
              libraryHeaderTitle,
              showLibraryHeader,
              showDdc,
              showAuthorCode,
              showBookTitle,
              showAccessionNo,
              showBarcode,
              showCuttingBorder,
              lineOrder,
              bgColor,
              textColor,
              borderStyle,
              columnsPerRow,
              rowsPerSheet,
              gapX,
              gapY,
              fontSizeHeader,
              fontSizeDdc,
              fontSizeAuthor,
              fontSizeTitle,
              fontSizeAccession,
              fontFamily,
              textAlign
            };
          }
          return t;
        });
        localStorage.setItem('spine_label_templates', JSON.stringify(updated));
        return updated;
      });
    }
  }, [
    selectedTemplateId,
    labelWidthMm,
    labelHeightMm,
    spineThicknessMm,
    marginTopMm,
    marginLeftMm,
    libraryHeaderTitle,
    showLibraryHeader,
    showDdc,
    showAuthorCode,
    showBookTitle,
    showAccessionNo,
    showBarcode,
    showCuttingBorder,
    lineOrder,
    bgColor,
    textColor,
    borderStyle,
    columnsPerRow,
    rowsPerSheet,
    gapX,
    gapY,
    fontSizeHeader,
    fontSizeDdc,
    fontSizeAuthor,
    fontSizeTitle,
    fontSizeAccession,
    fontFamily,
    textAlign
  ]);

  // Save rules to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('spine_label_ddc_rules', JSON.stringify(rules));
  }, [rules]);

  // Helper: Resolve which template applies to a given book
  const resolveTemplateForBook = (book: BookRecord): SpineTemplate => {
    const ddcVal = (book.noDdc || '').trim().split(' ')[0];
    
    // Sort rules by DDC prefix length in descending order, so that specific rules (e.g. "297") take precedence over general ones ("2xx" / "2")
    const sortedRules = [...rules].sort((a, b) => b.ddcPrefix.length - a.ddcPrefix.length);

    for (const rule of sortedRules) {
      const cleanPrefix = rule.ddcPrefix.toLowerCase().replace(/x/g, '').trim();
      if (cleanPrefix) {
        const cleanDdc = ddcVal.replace(/^[^0-9]*/, ''); // strip any leading letters
        if (cleanDdc.startsWith(cleanPrefix)) {
          const matchedTemplate = templates.find(t => t.id === rule.templateId);
          if (matchedTemplate) {
            return matchedTemplate;
          }
        }
      }
    }

    // Default template fallback
    const currentSel = templates.find(t => t.id === selectedTemplateId);
    return currentSel || templates.find(t => t.id === 'default') || templates[0];
  };

  // Helper: Get matched rule for displaying info in UI
  const getMatchedRuleForBook = (book: BookRecord): DdcRule | null => {
    const ddcVal = (book.noDdc || '').trim().split(' ')[0];
    const sortedRules = [...rules].sort((a, b) => b.ddcPrefix.length - a.ddcPrefix.length);

    for (const rule of sortedRules) {
      const cleanPrefix = rule.ddcPrefix.toLowerCase().replace(/x/g, '').trim();
      if (cleanPrefix) {
        const cleanDdc = ddcVal.replace(/^[^0-9]*/, '');
        if (cleanDdc.startsWith(cleanPrefix)) {
          return rule;
        }
      }
    }
    return null;
  };

  // Helper: Save current settings as a brand new template
  const handleCreateNewTemplate = (name: string) => {
    if (!name.trim()) return;
    const newId = 'temp-' + Date.now();
    const newTemplate: SpineTemplate = {
      id: newId,
      name: name.trim(),
      labelWidthMm,
      labelHeightMm,
      spineThicknessMm,
      marginTopMm,
      marginLeftMm,
      libraryHeaderTitle,
      showLibraryHeader,
      showDdc,
      showAuthorCode,
      showBookTitle,
      showAccessionNo,
      showBarcode,
      showCuttingBorder,
      lineOrder,
      bgColor,
      textColor,
      borderStyle,
      columnsPerRow,
      rowsPerSheet,
      gapX,
      gapY,
      fontSizeHeader,
      fontSizeDdc,
      fontSizeAuthor,
      fontSizeTitle,
      fontSizeAccession,
      fontFamily,
      textAlign
    };

    setTemplates(prev => {
      const updated = [...prev, newTemplate];
      localStorage.setItem('spine_label_templates', JSON.stringify(updated));
      return updated;
    });
    setSelectedTemplateId(newId);
    localStorage.setItem('spine_label_selected_template_id', newId);
  };

  // Helper: Delete a user-created template
  const handleDeleteTemplate = (idToDelete: string) => {
    if (idToDelete === 'default' || idToDelete === '2xx-agama') {
      setRuleError('Sistem templat lalai tidak boleh dipadam.');
      return;
    }
    setTemplates(prev => {
      const updated = prev.filter(t => t.id !== idToDelete);
      localStorage.setItem('spine_label_templates', JSON.stringify(updated));
      return updated;
    });
    if (selectedTemplateId === idToDelete) {
      setSelectedTemplateId('default');
      localStorage.setItem('spine_label_selected_template_id', 'default');
    }
    
    // Clean up any rules that used this template
    setRules(prev => prev.filter(r => r.templateId !== idToDelete));
  };

  const activeBook = books.find((b) => b.id === targetBookId) || books[0];

  const liveTemplate: SpineTemplate = {
    id: selectedTemplateId,
    name: templates.find(t => t.id === selectedTemplateId)?.name || 'Custom',
    labelWidthMm,
    labelHeightMm,
    spineThicknessMm,
    marginTopMm,
    marginLeftMm,
    libraryHeaderTitle,
    showLibraryHeader,
    showDdc,
    showAuthorCode,
    showBookTitle,
    showAccessionNo,
    showBarcode,
    showCuttingBorder,
    lineOrder,
    bgColor,
    textColor,
    borderStyle,
    columnsPerRow,
    rowsPerSheet,
    gapX,
    gapY,
    fontSizeHeader,
    fontSizeDdc,
    fontSizeAuthor,
    fontSizeTitle,
    fontSizeAccession,
    fontFamily,
    textAlign
  };

  const openPrintWindow = () => {
    if (booksToPrint.length === 0) {
      setRuleError('Tiada buku dipilih untuk dicetak. Sila pilih sekurang-kurangnya satu buku daripada senarai.');
      return;
    }

    const printElement = document.getElementById('a4-print-sheet-area');
    if (!printElement) {
      try {
        window.print();
      } catch (e) {
        console.warn('Direct print fallback failed:', e);
      }
      return;
    }

    const printWin = window.open('', '_blank', 'width=1000,height=800');
    if (!printWin) {
      try {
        window.print();
      } catch (e) {
        setRuleError('Fungsi tetingkap timbul (pop-up) disekat oleh pelayar anda. Sila benarkan tetingkap timbul.');
      }
      return;
    }

    const labelsHtml = printElement.innerHTML;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Cetak Tulang Buku - Pustaka Keluarga</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background-color: white !important;
              color: black !important;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            }
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
            }
          </style>
        </head>
        <body class="bg-white text-black p-0 m-0">
          <div class="no-print bg-slate-900 text-white p-3 px-6 flex items-center justify-between shadow-md sticky top-0 z-50">
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm">📄 Helaian Stiker Tulang Buku A4 (${booksToPrint.length} Buku Sedia Cetak)</span>
              <span class="text-xs text-slate-300">| Sedia untuk dicetak</span>
            </div>
            <div class="flex items-center gap-3">
              <button onclick="window.print()" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-all flex items-center gap-1.5">
                🖨️ Cetak Helaian Ini
              </button>
              <button onclick="window.close()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-all">
                Tutup
              </button>
            </div>
          </div>
          <div class="flex justify-center p-6 bg-slate-200/60 min-h-screen print:p-0 print:bg-white">
            <div
              style="
                display: grid;
                grid-template-columns: repeat(${columnsPerRow}, ${labelWidthMm}mm);
                grid-auto-rows: ${labelHeightMm}mm;
                column-gap: ${gapX}mm;
                row-gap: ${gapY}mm;
                justify-content: ${marginLeftMm > 0 ? 'flex-start' : 'center'};
                align-content: start;
                width: 210mm;
                min-height: 297mm;
                padding-top: ${marginTopMm}mm;
                padding-left: ${marginLeftMm}mm;
                padding-right: 10mm;
                padding-bottom: 10mm;
                box-sizing: border-box;
                background: white;
              "
              class="shadow-2xl print:shadow-none bg-white rounded-sm"
            >
              ${labelsHtml}
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handlePrint = (forceNewWindow = false) => {
    if (booksToPrint.length === 0) {
      setRuleError('Tiada buku dipilih untuk dicetak. Sila pilih sekurang-kurangnya satu buku daripada senarai.');
      return;
    }

    const count = Math.min(booksToPrint.length, columnsPerRow * rowsPerSheet);

    if (forceNewWindow) {
      openPrintWindow();
      if (onToggleBookSpinePrinted || onToggleBulkBookSpinePrinted) {
        setTimeout(() => {
          setConfirmMarkAllCount(count);
        }, 1000);
      }
      return;
    }

    try {
      window.print();
      if (onToggleBookSpinePrinted || onToggleBulkBookSpinePrinted) {
        setTimeout(() => {
          setConfirmMarkAllCount(count);
        }, 600);
      }
    } catch (err) {
      console.warn('Direct window.print failed, opening standalone window:', err);
      openPrintWindow();
      if (onToggleBookSpinePrinted || onToggleBulkBookSpinePrinted) {
        setTimeout(() => {
          setConfirmMarkAllCount(count);
        }, 1000);
      }
    }
  };

  const executeMarkAllAsPrinted = () => {
    if ((onToggleBookSpinePrinted || onToggleBulkBookSpinePrinted) && confirmMarkAllCount !== null && booksToPrint.length > 0) {
      const count = Math.min(booksToPrint.length, confirmMarkAllCount);
      const booksToMark = booksToPrint.slice(0, count);
      const bookIds = booksToMark.map(b => b.id);
      if (onToggleBulkBookSpinePrinted) {
        onToggleBulkBookSpinePrinted(bookIds, true);
      } else if (onToggleBookSpinePrinted) {
        bookIds.forEach(id => onToggleBookSpinePrinted(id, true));
      }
      setConfirmMarkAllCount(null);
    }
  };

  const resetToDefault = () => {
    setLabelWidthMm(55);
    setLabelHeightMm(60);
    setSpineThicknessMm(23);
    setLibraryHeaderTitle('PUSTAKA KELUARGA VEDSAPURA');
    setShowLibraryHeader(true);
    setShowDdc(true);
    setShowAuthorCode(true);
    setShowBookTitle(true);
    setShowAccessionNo(false);
    setShowBarcode(false);
    setShowCuttingBorder(true);
    setBgColor('#d4ff00');
    setTextColor('#000000');
    setBorderStyle('solid');
    setColumnsPerRow(3);
    setRowsPerSheet(7);
    setGapX(5);
    setGapY(5);
    setFontSizeHeader(10);
    setFontSizeDdc(13);
    setFontSizeAuthor(10);
    setFontSizeTitle(10);
    setFontSizeAccession(9);
    setFontFamily('font-mono');
    setTextAlign('text-center');
  };

  const moveLineOrder = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...lineOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setLineOrder(newOrder);
  };

  if (!activeBook && books.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        Tiada rekod buku tersedia untuk cetakan label. Sila tambah buku dahulu.
      </div>
    );
  }

  const renderLabelContent = (book: BookRecord, isPreview = false, overrideTemplate?: SpineTemplate) => {
    const { ddcOnly, authorCode } = parseDdcAndAuthorCode(book.noDdc, book.pengarang);
    const author3 = authorCode !== '-' ? authorCode : get3LetterAuthorCode(book.pengarang);
    const ddcVal = ddcOnly !== '-' ? ddcOnly : (book.noDdc ? book.noDdc.trim() : '000.0');

    const templateToUse = overrideTemplate || resolveTemplateForBook(book);

    // Enforce active physical sheet measurements (labelWidthMm & labelHeightMm)
    const activeWidth = labelWidthMm || templateToUse.labelWidthMm || 55;
    const activeHeight = labelHeightMm || templateToUse.labelHeightMm || 60;

    // Apply Auto DDC Category Color Recognition if enabled
    let finalBgColor = templateToUse.bgColor;
    let finalTextColor = templateToUse.textColor;

    if (autoDdcColorEnabled) {
      const ddcClassKey = getDdcClassForGenerator(book.noDdc);
      const autoColor = customDdcColors[ddcClassKey] || DDC_COLOR_PALETTE[ddcClassKey];
      if (autoColor) {
        finalBgColor = autoColor.bgColor;
        finalTextColor = autoColor.textColor;
      }
    }

    const t: SpineTemplate = {
      ...templateToUse,
      labelWidthMm: activeWidth,
      labelHeightMm: activeHeight,
      bgColor: finalBgColor,
      textColor: finalTextColor,
    };

    const isSolidLight = t.borderStyle === 'solid-light';
    const isNone = t.borderStyle === 'none';
    const borderClass = isNone 
      ? 'border-0' 
      : isSolidLight 
      ? 'border border-slate-300 dark:border-slate-700' 
      : 'border-2 border-slate-900 dark:border-slate-800';

    return (
      <div
        style={{
          backgroundColor: t.bgColor,
          color: t.textColor,
          width: `${t.labelWidthMm}mm`,
          height: `${t.labelHeightMm}mm`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          borderStyle: t.borderStyle === 'solid-light' ? 'solid' : t.borderStyle,
        }}
        className={`${borderClass} p-1.5 rounded-md flex flex-col justify-center items-center text-center ${t.textAlign} ${t.fontFamily} shadow-xs relative shrink-0`}
      >
        {t.showCuttingBorder && (
          <div className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-slate-900" style={{ borderColor: t.textColor }}></div>
        )}
        {t.showCuttingBorder && (
          <div className="absolute top-1 right-1 w-1.5 h-1.5 border-t border-r border-slate-900" style={{ borderColor: t.textColor }}></div>
        )}
        {t.showCuttingBorder && (
          <div className="absolute bottom-1 left-1 w-1.5 h-1.5 border-b border-l border-slate-900" style={{ borderColor: t.textColor }}></div>
        )}
        {t.showCuttingBorder && (
          <div className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-slate-900" style={{ borderColor: t.textColor }}></div>
        )}

        <div className="w-full flex flex-col justify-center items-center text-center space-y-0.5 my-auto font-bold" style={{ color: t.textColor, textAlign: 'center' }}>
          {t.lineOrder.map((itemKey) => {
            if (itemKey === 'header' && t.showLibraryHeader) {
              return (
                <div key="header" style={{ fontSize: `${t.fontSizeHeader}pt` }} className="w-full text-center font-bold tracking-tighter uppercase opacity-85 border-b border-current pb-0.5 truncate">
                  {t.libraryHeaderTitle}
                </div>
              );
            }
            if (itemKey === 'ddc' && t.showDdc) {
              return (
                <div key="ddc" style={{ fontSize: `${t.fontSizeDdc}pt` }} className="w-full text-center font-black tracking-tight my-0.5">
                  {ddcVal}
                </div>
              );
            }
            if (itemKey === 'authorCode' && t.showAuthorCode) {
              return (
                <div key="authorCode" style={{ fontSize: `${t.fontSizeAuthor}pt` }} className="w-full text-center font-extrabold uppercase">
                  {author3}
                </div>
              );
            }
            if (itemKey === 'title' && t.showBookTitle) {
              return (
                <div 
                  key="title" 
                  style={{ 
                    fontSize: `${t.fontSizeTitle}pt`,
                    maxHeight: '2.4em',
                    lineHeight: '1.2',
                    overflow: 'hidden',
                    display: 'block',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    textAlign: 'center'
                  }} 
                  className="w-full text-center font-semibold px-1"
                >
                  {book.judul}
                </div>
              );
            }
            if (itemKey === 'accessionNo' && t.showAccessionNo) {
              return (
                <div key="accessionNo" style={{ fontSize: `${t.fontSizeAccession}pt` }} className="w-full text-center font-mono tracking-tight">
                  {book.nomborPerolehan || 'PER-001'}
                </div>
              );
            }
            if (itemKey === 'barcode' && t.showBarcode) {
              return (
                <div key="barcode" className="w-full text-center flex items-center justify-center bg-slate-900 text-white text-[7px] tracking-widest py-0.5 rounded mt-0.5 font-mono">
                  ||||| | ||||| |||| {book.isbn ? book.isbn.slice(-4) : '9789'}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  };

  const totalLabelsCount = books.length;

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-600" />
            <span>Cetak Helaian Stiker Tulang Buku</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Jumlah stiker sedia untuk dicetak: <strong className="text-emerald-600 dark:text-emerald-400">{totalLabelsCount} label</strong>. Sedia kertas stiker A4 pada pencetak anda.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onNavigateCatalog && (
            <button
              type="button"
              onClick={onNavigateCatalog}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all"
            >
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Katalog</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsPreviewModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Eye className="w-4 h-4 text-emerald-600" />
            <span>Print Preview</span>
          </button>
          <button
            type="button"
            onClick={() => handlePrint(false)}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md hover:bg-emerald-700 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Sekarang</span>
          </button>
          <button
            type="button"
            onClick={() => handlePrint(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs shadow-md hover:opacity-90 flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            title="Buka helaian cetakan dalam tetingkap baharu"
          >
            <span>🗂️ Tetingkap Baharu</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Controls (span 7), Right Sticky Preview (span 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Customization Controls */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-emerald-600" />
                <span>Tetapan & Pemboleh Ubah Label Tulang Buku</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sesuaikan ukuran fizikal, saiz fon, medan paparan, warna, dan tetapan cetakan stiker.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={handleSaveAllSettings}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs transition-all cursor-pointer active:scale-95"
                title="Simpan Semua Tetapan Label ke Firebase & Tempatan"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Tetapan</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportSettings('xlsx')}
                className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold text-xs flex items-center gap-1.5 shrink-0 border border-indigo-200/80 dark:border-indigo-800 transition-all cursor-pointer active:scale-95"
                title="Eksport Tetapan Label ke Fail Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Eksport XLS</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportSettings('csv')}
                className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold text-xs flex items-center gap-1.5 shrink-0 border border-blue-200/80 dark:border-blue-800 transition-all cursor-pointer active:scale-95"
                title="Eksport Tetapan Label ke Fail CSV (.csv)"
              >
                <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Eksport CSV</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 font-bold text-xs flex items-center gap-1.5 shrink-0 border border-amber-200/80 dark:border-amber-800 transition-all cursor-pointer active:scale-95"
                title="Muat Naik / Import Tetapan Label dari Fail CSV atau XLSX"
              >
                <Upload className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Import CSV/XLS</span>
              </button>

              <button
                type="button"
                disabled
                title="Dinyahaktifkan untuk mengelakkan kehilangan tetapan cetak label"
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-not-allowed opacity-50 border border-slate-200/60 dark:border-slate-700/60 select-none"
              >
                <RotateCcw className="w-3.5 h-3.5 opacity-60" />
                <span>Tetapan Asal</span>
              </button>
            </div>
          </div>

          {importSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-between shadow-md animate-fade-in border border-indigo-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                <span>{importSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setImportSuccessMsg(null)}
                className="p-1 hover:bg-indigo-700 rounded-lg text-white/80 hover:text-white cursor-pointer ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showSaveSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-between shadow-md animate-fade-in border border-emerald-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                <span>Semua 6 Seksyen Tetapan Label (Pengurusan Templat, Ukuran Fizikal, Medan & Susunan, Warna & Sempadan, Tetapan A4, Saiz Fon & Tipografi) Berjaya Disimpan ke Firebase & Tempatan!</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveSuccess(false)}
                className="p-1 hover:bg-emerald-700 rounded-lg text-white/80 hover:text-white cursor-pointer ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* SEKSYEN: Pemilihan Buku mengikut Kategori DDC */}
          <div className="p-5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/60 dark:border-indigo-900/30 space-y-4">
            {/* Tagged from Catalog Notice & Untag Action */}
            {spineExportTagIds && spineExportTagIds.length > 0 && (
              <div className="p-3.5 rounded-xl bg-indigo-100/80 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-indigo-900 dark:text-indigo-200">
                  <Bookmark className="w-4 h-4 text-indigo-600 fill-current shrink-0" />
                  <span>
                    📌 Menunjukkan <strong className="text-indigo-950 dark:text-indigo-100">{spineExportTagIds.length} buku yang ditanda dari Katalog</strong> untuk cetakan label.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onClearAllSpineExportTags) {
                      onClearAllSpineExportTags();
                    } else if (onToggleBulkSpineExportTags) {
                      onToggleBulkSpineExportTags(spineExportTagIds, false);
                    } else if (onToggleSpineExportTag) {
                      spineExportTagIds.forEach(id => onToggleSpineExportTag(id));
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                  title="Nyahaktifkan semua tanda katalog agar keseluruhan katalog boleh dipilih semula"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Nyahaktifkan Semua Tanda ({spineExportTagIds.length})</span>
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400 fill-indigo-500/10" />
                  <span>Pilih Buku Untuk Stiker</span>
                </h4>
                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 mt-0.5">
                  Klik kategori DDC untuk pilih/tambah pelbagai kategori (cth: 200 & 900) untuk dicetak serentak dalam 1 helaian A4.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onToggleAllowDraftSpinePrint && (
                  <button
                    type="button"
                    onClick={onToggleAllowDraftSpinePrint}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                      allowDraftSpinePrint
                        ? 'bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-300 dark:ring-amber-700'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                    title="Tekan untuk benarkan / sekat buku berstatus Draf daripada senarai cetakan label"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{allowDraftSpinePrint ? '✓ Sertakan Draf' : 'Benarkan Tanda Buku Draf'}</span>
                  </button>
                )}
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors shrink-0 shadow-2xs">
                  <input
                    type="checkbox"
                    checked={includePrintedBooks}
                    onChange={(e) => setIncludePrintedBooks(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                  />
                  <span>Sertakan Telah Dicetak ({printedBooks.length})</span>
                </label>
              </div>
            </div>

            {/* Status Filter Tabs (Semua / Belum Dicetak / Telah Dicetak) */}
            <div className="flex flex-wrap items-center gap-2 pt-2 pb-1 border-t border-indigo-100/60 dark:border-indigo-900/30">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Tapis Status:</span>
              <button
                type="button"
                onClick={() => setSpineStatusFilter('semua')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  spineStatusFilter === 'semua'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                Semua ({candidateBooks.length})
              </button>
              <button
                type="button"
                onClick={() => setSpineStatusFilter('belum_dicetak')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  spineStatusFilter === 'belum_dicetak'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Belum Dicetak ({candidateBooks.filter(b => !isBookSpinePrinted(b)).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSpineStatusFilter('telah_dicetak')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  spineStatusFilter === 'telah_dicetak'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Telah Dicetak ({candidateBooks.filter(b => isBookSpinePrinted(b)).length})</span>
              </button>
            </div>

            {/* DDC Pills (Multi-Select Supported) */}
            <div className="flex flex-wrap items-center gap-1.5 pb-2">
              {ddcCategoriesForGenerator.map((cls) => {
                const categoryCount = candidateBooks.filter(b => getDdcClassForGenerator(b.noDdc) === cls.key).length;
                const finalCount = cls.key === 'semua' ? candidateBooks.length : categoryCount;
                const isActive = selectedDdcFilters.includes(cls.key);
                const paletteItem = customDdcColors[cls.key] || DDC_COLOR_PALETTE[cls.key];
                
                return (
                  <button
                    key={cls.key}
                    type="button"
                    onClick={() => handleToggleDdcFilter(cls.key)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {paletteItem && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20 shadow-2xs inline-block"
                        style={{ backgroundColor: paletteItem.bgColor }}
                        title={`Warna Kategori: ${paletteItem.shortDesc || paletteItem.label}`}
                      ></span>
                    )}
                    {isActive && cls.key !== 'semua' && <Check className="w-3 h-3 text-indigo-200" />}
                    <span>{cls.label}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                      isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {finalCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bulk Actions & Count Info */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-150/50 dark:border-slate-800/50 pt-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Kategori Dipilih:{' '}
                <strong className="text-indigo-600 dark:text-indigo-400">
                  {selectedDdcFilters.includes('semua')
                    ? 'Semua DDC'
                    : selectedDdcFilters.map(k => ddcCategoriesForGenerator.find(c => c.key === k)?.label).filter(Boolean).join(', ')}
                </strong>{' '}
                ({booksToPrint.length} sedia dicetak daripada {filteredUnprintedBooks.length} buku)
              </span>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const categoryUnprintedBooks = candidateBooks.filter(b => {
                      const matchesDdc = selectedDdcFilters.includes('semua') || selectedDdcFilters.includes(getDdcClassForGenerator(b.noDdc));
                      return matchesDdc && !isBookSpinePrinted(b);
                    });
                    const idsInFilter = categoryUnprintedBooks.map(b => b.id);
                    setSelectedBookIds(prev => {
                      const otherIds = prev.filter(id => !idsInFilter.includes(id));
                      return [...otherIds, ...idsInFilter];
                    });
                  }}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Pilih Semua (Buku Belum Cetak)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idsInFilter = filteredUnprintedBooks.map(b => b.id);
                    setSelectedBookIds(prev => prev.filter(id => !idsInFilter.includes(id)));
                  }}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-[10px] rounded-lg hover:bg-slate-50 cursor-pointer active:scale-95"
                >
                  <span>Nyahpilih Kategori Ini</span>
                </button>
              </div>
            </div>

            {/* Live Selected Count Banner */}
            <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between text-emerald-900 dark:text-emerald-200">
              <span className="font-bold flex items-center gap-1.5">
                <span>📌 Bilangan Semasa Dipilih untuk Dicetak:</span>
                <strong className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-xs">{booksToPrint.length} buku</strong>
              </span>
              <span className="text-[11px] opacity-80">
                (Daripada {filteredUnprintedBooks.length} buku dalam kategori ini)
              </span>
            </div>

            {/* Checklist Panel */}
            <div className="border border-slate-150 dark:border-slate-800 rounded-xl max-h-[160px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/40">
              {filteredUnprintedBooks.map(b => {
                const isChecked = selectedBookIds.includes(b.id);
                const printed = isBookSpinePrinted(b);
                const { ddcOnly, authorCode } = parseDdcAndAuthorCode(b.noDdc, b.pengarang);
                const ddcClassKey = getDdcClassForGenerator(b.noDdc);
                const autoColor = customDdcColors[ddcClassKey] || DDC_COLOR_PALETTE[ddcClassKey];

                return (
                  <label
                    key={b.id}
                    className="flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-850/40 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedBookIds(prev =>
                          isChecked ? prev.filter(id => id !== b.id) : [...prev, b.id]
                        );
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                          {b.judul}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {autoColor && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold border border-black/10 flex items-center gap-1"
                              style={{ backgroundColor: autoColor.bgColor, color: autoColor.textColor }}
                            >
                              {ddcClassKey}
                            </span>
                          )}
                          {spineExportTagIds.includes(b.id) && onToggleSpineExportTag && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onToggleSpineExportTag(b.id);
                              }}
                              className="px-1.5 py-0.5 rounded-md bg-indigo-50 hover:bg-rose-50 dark:bg-indigo-950/60 dark:hover:bg-rose-950/60 text-indigo-700 hover:text-rose-600 dark:text-indigo-300 dark:hover:text-rose-400 border border-indigo-200 hover:border-rose-300 text-[9px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Klik untuk nyahaktifkan tanda buku ini daripada cetakan"
                            >
                              <Bookmark className="w-2.5 h-2.5 fill-current" />
                              <span>Ditanda</span>
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {printed && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-1 py-0.2 rounded font-medium">
                              🏷️ Telah Dicetak
                            </span>
                          )}
                          {b.catatan?.includes('nota kecil') && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-1 py-0.2 rounded font-medium">Nota Kecil</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        No. DDC: <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{ddcOnly}</span> | Huruf Pengarang: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">{authorCode}</span> | Pengarang: {b.pengarang || 'Tiada'}
                      </p>
                    </div>
                  </label>
                );
              })}
              {filteredUnprintedBooks.length === 0 && (
                <p className="text-center text-[11px] text-slate-400 py-6 italic">
                  Tiada buku dalam kategori ini.
                </p>
              )}
            </div>
          </div>

          {/* Sub-seksyen: Pengurusan Templat & Peraturan */}
          <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/10 border border-emerald-100/80 dark:border-emerald-900/40 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Pengurusan Templat & Peraturan DDC</span>
                </h4>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                  Simpan kombinasi tetapan sebagai preset, atau atur peraturan templat automatik mengikut kelas DDC buku.
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs">
                {firebaseSyncStatus === 'saving' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    <span>Menyimpan ke Firebase...</span>
                  </>
                )}
                {firebaseSyncStatus === 'synced' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>☁️ Disimpan & Disinkronisasi (Firebase DB)</span>
                  </>
                )}
                {firebaseSyncStatus === 'offline' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Simpanan Tempatan</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Dropdown: Pilih Templat Aktif */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Pilih Templat Aktif (Diedit)
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => {
                      setSelectedTemplateId(e.target.value);
                      localStorage.setItem('spine_label_selected_template_id', e.target.value);
                      setShowTemplateDeleteConfirm(false);
                    }}
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.id === 'default' ? '(Lalai)' : t.id === '2xx-agama' ? '(Sistem 2xx)' : ''}
                      </option>
                    ))}
                  </select>
                  {selectedTemplateId !== 'default' && selectedTemplateId !== '2xx-agama' && (
                    <button
                      type="button"
                      onClick={() => setShowTemplateDeleteConfirm(true)}
                      className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/40 transition-colors shrink-0 cursor-pointer"
                      title="Padam Templat Ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {showTemplateDeleteConfirm && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900/30 text-xs animate-fade-in">
                    <span className="text-[11px] text-rose-800 dark:text-rose-200 font-extrabold flex items-center gap-1">
                      ⚠️ Padam templat "{templates.find(t => t.id === selectedTemplateId)?.name}"?
                    </span>
                    <div className="flex gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteTemplate(selectedTemplateId);
                          setShowTemplateDeleteConfirm(false);
                        }}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px] cursor-pointer shadow-xs"
                      >
                        Ya, Padam
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTemplateDeleteConfirm(false)}
                        className="px-3 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-[10px] hover:bg-slate-50 cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Simpan templat baharu */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Simpan Tetapan Semasa Sebagai Templat Baru
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const name = formData.get('templateName') as string;
                    if (name && name.trim()) {
                      handleCreateNewTemplate(name);
                      e.currentTarget.reset();
                    }
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    name="templateName"
                    placeholder="Nama templat baharu (cth: Stiker Rak A)"
                    required
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    Simpan
                  </button>
                </form>
              </div>
            </div>

            {/* Rule Manager Section */}
            <div className="pt-3 border-t border-emerald-100 dark:border-emerald-900/30 space-y-3">
              <div>
                <h5 className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Pengurus Peraturan Automatik (DDC Rule Manager)</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-[9px] text-emerald-800 dark:text-emerald-300 font-bold">Smart Auto-Apply</span>
                </h5>
                <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                  Tetapkan format/templat khusus secara automatik mengikut awalan nombor DDC buku.
                </p>
              </div>

              {ruleError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-200 text-xs font-semibold animate-fade-in">
                  {ruleError}
                </div>
              )}

              {/* Rules List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                {rules.map((rule) => {
                  const ruleTemplate = templates.find(t => t.id === rule.templateId);
                  return (
                    <div key={rule.id} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 text-[11px] shadow-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[85%]">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-extrabold text-[9px]">
                          DDC {rule.ddcPrefix}
                        </span>
                        <span>➔</span>
                        <span className="text-slate-900 dark:text-slate-100 font-bold truncate">
                          {ruleTemplate?.name || 'Sila pilih templat'}
                        </span>
                      </div>
                      {ruleToDelete === rule.id ? (
                        <div className="flex items-center gap-1 shrink-0 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded-lg animate-fade-in">
                          <span className="text-[9px] text-rose-700 dark:text-rose-300 font-extrabold mr-1">Padam?</span>
                          <button
                            type="button"
                            onClick={() => {
                              setRules(prev => prev.filter(r => r.id !== rule.id));
                              setRuleToDelete(null);
                            }}
                            className="px-1.5 py-0.5 bg-rose-600 text-white rounded font-bold text-[9px] hover:bg-rose-700 cursor-pointer"
                          >
                            Ya
                          </button>
                          <button
                            type="button"
                            onClick={() => setRuleToDelete(null)}
                            className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-bold text-[9px] hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRuleToDelete(rule.id)}
                          className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Padam Peraturan"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {rules.length === 0 && (
                  <p className="col-span-2 text-center text-[10px] text-slate-400 py-1">
                    Tiada peraturan tersuai. Semua buku akan menggunakan templat aktif secara lalai.
                  </p>
                )}
              </div>

              {/* Form to Add New Rule */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const prefix = (formData.get('rulePrefix') as string || '').trim();
                  const tId = formData.get('ruleTemplateId') as string;
                  if (!prefix) return;

                  // Prevent duplicates for same prefix
                  if (rules.some(r => r.ddcPrefix.toLowerCase() === prefix.toLowerCase())) {
                    setRuleError(`Peraturan untuk awalan DDC "${prefix}" sudah wujud.`);
                    return;
                  }
                  
                  const newRule: DdcRule = {
                    id: 'rule-' + Date.now(),
                    ddcPrefix: prefix,
                    templateId: tId
                  };
                  
                  setRules(prev => [...prev, newRule]);
                  e.currentTarget.reset();
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-emerald-100/50 dark:border-emerald-900/20"
              >
                <div>
                  <input
                    type="text"
                    name="rulePrefix"
                    placeholder="Awalan DDC (cth: 2xx, 300, 297)"
                    required
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <select
                    name="ruleTemplateId"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        Guna: {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl transition-all shadow-xs cursor-pointer text-center"
                >
                  Tambah Peraturan
                </button>
              </form>
            </div>
          </div>

          {/* 1. Ukuran Fizikal Label */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Ukuran Fizikal Label (Milimeter - mm)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lebar Label (mm)
                </label>
                <input
                  type="number"
                  value={labelWidthMm}
                  onChange={(e) => setLabelWidthMm(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tinggi Label (mm)
                </label>
                <input
                  type="number"
                  value={labelHeightMm}
                  onChange={(e) => setLabelHeightMm(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ketebalan Tulang (mm)
                </label>
                <input
                  type="number"
                  value={spineThicknessMm}
                  onChange={(e) => setSpineThicknessMm(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* 2. Medan & Susunan Kandungan */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Medan & Susunan Kandungan Tulang Buku</span>
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Teks Header Pustaka
              </label>
              <input
                type="text"
                value={libraryHeaderTitle}
                onChange={(e) => setLibraryHeaderTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <input
                  type="checkbox"
                  checked={showLibraryHeader}
                  onChange={(e) => setShowLibraryHeader(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Nama Pustaka</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <input
                  type="checkbox"
                  checked={showDdc}
                  onChange={(e) => setShowDdc(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>No. DDC</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <input
                  type="checkbox"
                  checked={showAuthorCode}
                  onChange={(e) => setShowAuthorCode(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Huruf Pengarang</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <input
                  type="checkbox"
                  checked={showBookTitle}
                  onChange={(e) => setShowBookTitle(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Judul Buku</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <input
                  type="checkbox"
                  checked={showAccessionNo}
                  onChange={(e) => setShowAccessionNo(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>No. Perolehan</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <input
                  type="checkbox"
                  checked={showBarcode}
                  onChange={(e) => setShowBarcode(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Kod Bar (Barcode)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <input
                  type="checkbox"
                  checked={showCuttingBorder}
                  onChange={(e) => setShowCuttingBorder(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Garisan Potong</span>
              </label>
            </div>

            {/* Susunan Baris pada Label */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Susunan Baris pada Label (Gunakan anak panah ↑ dan ↓)
              </label>
              <div className="space-y-1.5">
                {lineOrder.map((keyName, idx) => {
                  const labelsMap: Record<string, string> = {
                    header: 'Nama Pustaka',
                    ddc: 'No. DDC',
                    authorCode: 'Huruf Pengarang (Cutter)',
                    title: 'Judul Buku',
                    accessionNo: 'No. Perolehan',
                    barcode: 'Kod Bar (Barcode)',
                  };
                  return (
                    <div key={keyName} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span>{labelsMap[keyName]}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveLineOrder(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-300"
                          title="Naikkan"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLineOrder(idx, 'down')}
                          disabled={idx === lineOrder.length - 1}
                          className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-300"
                          title="Turunkan"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Warna & Stail Sempadan */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Warna & Stail Sempadan</span>
            </h4>

            {/* Pengecam Warna DDC Automatik Toggle Card */}
            <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Pengecam Warna DDC Automatik</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      Standard Perpustakaan
                    </span>
                  </h5>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={autoDdcColorEnabled}
                    onChange={(e) => setAutoDdcColorEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Toggle Button for Custom Color Editor */}
              <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
                  Tetapan Warna Kategori DDC
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (showDdcColorSettings) {
                      setShowDdcColorSettings(false);
                    } else {
                      setPasswordActionTarget('ddc_colors');
                      setClearPasswordInput('');
                      setPasswordError(false);
                      setShowPasswordModal(true);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>{showDdcColorSettings ? 'Tutup Tetapan Warna' : 'Sesuaikan Warna Kategori'}</span>
                </button>
              </div>

              {/* Custom Color Editor for DDC Palette (Collapsible) */}
              {showDdcColorSettings && (
                <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 space-y-2 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-0.5">
                    {(Object.entries(customDdcColors) as [string, DdcColorInfo][]).map(([key, item]) => (
                      <div
                        key={key}
                        className="p-2.5 rounded-xl border border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate">
                              {item.label}
                            </span>
                          </div>
                          {/* Live Badge Preview */}
                          <div
                            className="px-2 py-0.5 rounded-md font-mono font-bold text-[10px] shrink-0 border border-black/15 shadow-2xs flex items-center gap-1"
                            style={{ backgroundColor: item.bgColor, color: item.textColor }}
                          >
                            <span>{key}</span>
                            <span className="text-[8px] opacity-85 font-sans font-bold">Teks</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 text-[10px]">
                          {/* Background color picker */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold">Latar:</span>
                            <input
                              type="color"
                              value={item.bgColor}
                              onChange={(e) => handleUpdateDdcColor(key, 'bgColor', e.target.value)}
                              className="w-6 h-6 rounded-md cursor-pointer border border-slate-200 dark:border-slate-700 p-0 bg-transparent shrink-0"
                              title={`Tukar warna latar untuk DDC ${key}`}
                            />
                          </div>

                          {/* Text color picker & quick toggles */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold">Teks:</span>
                            <input
                              type="color"
                              value={item.textColor}
                              onChange={(e) => handleUpdateDdcColor(key, 'textColor', e.target.value)}
                              className="w-6 h-6 rounded-md cursor-pointer border border-slate-200 dark:border-slate-700 p-0 bg-transparent shrink-0"
                              title={`Tukar warna teks untuk DDC ${key}`}
                            />
                            <div className="flex gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateDdcColor(key, 'textColor', '#ffffff')}
                                className={`px-1.5 py-0.5 text-[8px] font-black rounded border cursor-pointer ${
                                  item.textColor.toLowerCase() === '#ffffff'
                                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}
                                title="Set teks warna Putih"
                              >
                                Putih
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateDdcColor(key, 'textColor', '#0f172a')}
                                className={`px-1.5 py-0.5 text-[8px] font-black rounded border cursor-pointer ${
                                  item.textColor.toLowerCase() === '#0f172a' || item.textColor.toLowerCase() === '#000000'
                                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}
                                title="Set teks warna Gelap/Hitam"
                              >
                                Gelap
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {autoDdcColorEnabled && (
              <p className="text-[10px] italic text-indigo-600 dark:text-indigo-400 font-medium">
                * Pengecam warna automatik sedang diaktifkan. Latar stiker akan dipadankan secara automatik mengikut kelas DDC buku.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Warna Latar Manual (Default)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-1 bg-white"
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Warna Teks
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-1 bg-white"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Stail Sempadan
                </label>
                <select
                  value={borderStyle}
                  onChange={(e) => setBorderStyle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="solid">Garisan Penuh (Solid)</option>
                  <option value="solid-light">Garisan Penuh (Light)</option>
                  <option value="dashed">Garisan Putus-putus (Dashed)</option>
                  <option value="dotted">Garisan Titik (Dotted)</option>
                  <option value="none">Tiada Sempadan</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Tetapan Helaian Stiker A4 */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Tetapan Helaian Stiker A4</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Margin Atas (mm)
                </label>
                <input
                  type="number"
                  value={marginTopMm}
                  onChange={(e) => setMarginTopMm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Margin Kiri (mm)
                </label>
                <input
                  type="number"
                  value={marginLeftMm}
                  onChange={(e) => setMarginLeftMm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kolom Sebaris
                </label>
                <input
                  type="number"
                  value={columnsPerRow}
                  onChange={(e) => setColumnsPerRow(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Baris Seperember
                </label>
                <input
                  type="number"
                  value={rowsPerSheet}
                  onChange={(e) => setRowsPerSheet(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jarak X (mm)
                </label>
                <input
                  type="number"
                  value={gapX}
                  onChange={(e) => setGapX(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jarak Y (mm)
                </label>
                <input
                  type="number"
                  value={gapY}
                  onChange={(e) => setGapY(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* 5. Saiz Fon & Tipografi */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Saiz Fon (Points - pt) & Tipografi</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Saiz Header Pustaka
                </label>
                <input
                  type="number"
                  value={fontSizeHeader}
                  onChange={(e) => setFontSizeHeader(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Saiz No. DDC
                </label>
                <input
                  type="number"
                  value={fontSizeDdc}
                  onChange={(e) => setFontSizeDdc(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Saiz Cutter Pengarang
                </label>
                <input
                  type="number"
                  value={fontSizeAuthor}
                  onChange={(e) => setFontSizeAuthor(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Saiz Judul Buku
                </label>
                <input
                  type="number"
                  value={fontSizeTitle}
                  onChange={(e) => setFontSizeTitle(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Saiz No. Perolehan
                </label>
                <input
                  type="number"
                  value={fontSizeAccession}
                  onChange={(e) => setFontSizeAccession(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jenis Fon
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="font-mono">Monospace (Piawaian Koleksi)</option>
                  <option value="font-sans">Sans-Serif (Moden)</option>
                  <option value="font-serif">Serif (Klasik)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jajaran Teks
                </label>
                <select
                  value={textAlign}
                  onChange={(e) => setTextAlign(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="text-center">Tengah (Center)</option>
                  <option value="text-left">Kiri (Left)</option>
                  <option value="text-right">Kanan (Right)</option>
                </select>
              </div>
            </div>
          </div>


        </div>

        {/* Right Column: Sticky Live Spine Preview (span 5) */}
        <div className="lg:col-span-5 sticky top-6 space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>Pratonton Tulang Live</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {labelWidthMm}mm × {labelHeightMm}mm
                </p>
              </div>
              <select
                value={targetBookId}
                onChange={(e) => setTargetBookId(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[160px] truncate cursor-pointer"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.judul}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center min-h-[300px]">
              <div id="spine-label-print-area" className="py-2">
                {renderLabelContent(activeBook, true, liveTemplate)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-4 text-center">
                Perubahan tetapan dikemas kini secara langsung pada templat aktif.
              </p>
            </div>

            {/* Dynamic Rule Badge */}
            <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/50 text-[11px] font-bold text-slate-600 dark:text-slate-300 justify-between">
              <span>Peraturan Auto DDC:</span>
              {(() => {
                const matchedRule = activeBook ? getMatchedRuleForBook(activeBook) : null;
                if (matchedRule) {
                  const ruleTemplateName = templates.find(t => t.id === matchedRule.templateId)?.name || 'Custom';
                  return (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold flex items-center gap-1">
                      <span>DDC {matchedRule.ddcPrefix}</span>
                      <span>➔</span>
                      <span>{ruleTemplateName}</span>
                    </span>
                  );
                } else {
                  const activeTemplateName = templates.find(t => t.id === selectedTemplateId)?.name || 'Default';
                  return (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 text-[10px] font-extrabold flex items-center gap-1">
                      <span>Lalai</span>
                      <span>➔</span>
                      <span>{activeTemplateName}</span>
                    </span>
                  );
                }
              })()}
            </div>

            {printedBooks.length > 0 && onToggleBookSpinePrinted && (
              <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-xs flex items-center justify-between gap-2">
                <span className="text-amber-800 dark:text-amber-200 text-[11px] font-medium">
                  <strong>{printedBooks.length} buku</strong> telah dicetak.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setClearPasswordInput('');
                    setPasswordError(false);
                    setShowPasswordModal(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] transition-all shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Padam Semua Status</span>
                </button>
              </div>
            )}




          </div>

          {/* Quick A4 Grid Sheet Preview Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span>Pratonton Grid A4 ({columnsPerRow} Kolom)</span>
              <span className="text-[10px] text-emerald-600 font-normal">{booksToPrint.length} Buku Dipilih</span>
            </h4>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex justify-center overflow-x-auto">
              <div
                className="grid bg-white p-3 rounded-lg border border-slate-300 shadow-inner overflow-hidden max-w-full"
                style={{
                  gridTemplateColumns: `repeat(${columnsPerRow}, ${labelWidthMm}mm)`,
                  gridAutoRows: `${labelHeightMm}mm`,
                  columnGap: `${gapX}mm`,
                  rowGap: `${gapY}mm`,
                  justifyContent: marginLeftMm > 0 ? 'flex-start' : 'center',
                  paddingTop: `${marginTopMm}mm`,
                  paddingLeft: `${marginLeftMm}mm`,
                  transform: 'scale(0.85)',
                  transformOrigin: 'top center',
                }}
              >
                {booksToPrint.slice(0, columnsPerRow * 2).map((b) => (
                  <div key={b.id} className="flex justify-center items-center">
                    {renderLabelContent(b, false)}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
              Mengikut tetapan: <strong>{columnsPerRow} Kolom</strong> ({labelWidthMm}mm × {labelHeightMm}mm) | Jarak X: {gapX}mm, Y: {gapY}mm | Margin: {marginTopMm}mm / {marginLeftMm}mm
            </p>
          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-emerald-600" />
                  <span>Pratonton Cetakan Helaian Stiker A4 ({booksToPrint.length} Buku Sedia Cetak)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Buku yang belum mempunyai nota status 'Tulang Dicetak' dipilih secara automatik.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 flex flex-col items-center justify-start bg-slate-50 dark:bg-slate-950/50 w-full">
              <div className="w-full overflow-x-auto flex justify-center py-2">
                <div
                  id="a4-preview-sheet-area"
                  className="grid bg-white text-slate-900 border border-slate-200 shadow-xl"
                  style={{
                    gridTemplateColumns: `repeat(${columnsPerRow}, ${labelWidthMm}mm)`,
                    gridAutoRows: `${labelHeightMm}mm`,
                    columnGap: `${gapX}mm`,
                    rowGap: `${gapY}mm`,
                    justifyContent: marginLeftMm > 0 ? 'flex-start' : 'center',
                    alignContent: 'start',
                    width: '210mm',
                    minHeight: '297mm',
                    paddingTop: `${marginTopMm}mm`,
                    paddingLeft: `${marginLeftMm}mm`,
                    paddingRight: '10mm',
                    paddingBottom: '10mm',
                    boxSizing: 'border-box',
                  }}
                >
                  {booksToPrint.slice(0, columnsPerRow * rowsPerSheet).map((b) => (
                    <div key={b.id} className="flex justify-center items-center">
                      {renderLabelContent(b, false)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Tutup Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setTimeout(() => handlePrint(true), 150);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-colors flex items-center gap-2 shadow-md cursor-pointer"
              >
                <span>🗂️ Cetak Tetingkap Baharu</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setTimeout(() => handlePrint(false), 150);
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for marking all as printed */}
      {confirmMarkAllCount !== null && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Tandakan Buku Sebagai Telah Dicetak?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Adakah anda telah berjaya mencetak helaian stiker ini? Menanda <strong>{confirmMarkAllCount} buku</strong> ini sebagai <strong>"Telah Dicetak"</strong> akan mengecualikannya daripada cetakan seterusnya.
              </p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setConfirmMarkAllCount(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Tidak, Kekalkan
              </button>
              <button
                type="button"
                onClick={executeMarkAllAsPrinted}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Ya, Tandakan Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden A4 Sheet for direct print if modal not opened (rendered via Portal directly into document.body) */}
      {createPortal(
        <div className="hidden print:block" id="a4-print-sheet-wrapper">
          <div
            id="a4-print-sheet-area"
            className="grid bg-white text-slate-900"
            style={{
              gridTemplateColumns: `repeat(${columnsPerRow}, ${labelWidthMm}mm)`,
              gridAutoRows: `${labelHeightMm}mm`,
              columnGap: `${gapX}mm`,
              rowGap: `${gapY}mm`,
              justifyContent: marginLeftMm > 0 ? 'flex-start' : 'center',
              alignContent: 'start',
              width: '210mm',
              minHeight: '297mm',
              paddingTop: `${marginTopMm}mm`,
              paddingLeft: `${marginLeftMm}mm`,
              paddingRight: '10mm',
              paddingBottom: '10mm',
              boxSizing: 'border-box',
            }}
          >
            {booksToPrint.slice(0, columnsPerRow * rowsPerSheet).map((b) => (
              <div key={b.id} className="flex justify-center items-center">
                {renderLabelContent(b, false)}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Print CSS Injection */}
      <style>{`
        @media print {
          #root {
            display: none !important;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #a4-print-sheet-wrapper {
            display: block !important;
            width: 210mm !important;
            min-height: 297mm !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #a4-print-sheet-area {
            display: grid !important;
            grid-template-columns: repeat(${columnsPerRow}, ${labelWidthMm}mm) !important;
            grid-auto-rows: ${labelHeightMm}mm !important;
            column-gap: ${gapX}mm !important;
            row-gap: ${gapY}mm !important;
            justify-content: ${marginLeftMm > 0 ? 'flex-start' : 'center'} !important;
            align-content: start !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding-top: ${marginTopMm}mm !important;
            padding-left: ${marginLeftMm}mm !important;
            padding-right: 10mm !important;
            padding-bottom: 10mm !important;
            box-sizing: border-box !important;
            background: white !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
                🔒
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Pengesahan Kata Laluan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Masukkan kata laluan untuk meneruskan.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="password"
                placeholder="Masukkan kata laluan..."
                value={clearPasswordInput}
                onChange={(e) => {
                  setClearPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (clearPasswordInput === '123') {
                      setShowPasswordModal(false);
                      if (passwordActionTarget === 'clear_printed') {
                        setShowClearPrintedConfirm(true);
                      } else if (passwordActionTarget === 'ddc_colors') {
                        setShowDdcColorSettings(true);
                      }
                    } else {
                      setPasswordError(true);
                    }
                  }
                }}
                autoFocus
                className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border ${
                  passwordError ? 'border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-700'
                } focus:outline-hidden focus:ring-2 focus:ring-amber-500`}
              />
              {passwordError && (
                <p className="text-[11px] font-semibold text-rose-600">
                  Kata laluan tidak sah. Sila cuba lagi (123).
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (clearPasswordInput === '123') {
                    setShowPasswordModal(false);
                    if (passwordActionTarget === 'clear_printed') {
                      setShowClearPrintedConfirm(true);
                    } else if (passwordActionTarget === 'ddc_colors') {
                      setShowDdcColorSettings(true);
                    }
                  } else {
                    setPasswordError(true);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
              >
                Sahkan
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showClearPrintedConfirm}
        title="Padam Semua Status Tulang Dicetak"
        message={`Adakah anda pasti untuk memadam status 'Tulang Dicetak' bagi semua ${printedBooks.length} buku ini?`}
        confirmLabel={`Padam Status (${printedBooks.length} Buku)`}
        variant="warning"
        onConfirm={() => {
          if (onToggleBookSpinePrinted) {
            printedBooks.forEach(b => onToggleBookSpinePrinted(b.id, false));
          }
          setShowClearPrintedConfirm(false);
        }}
        onCancel={() => setShowClearPrintedConfirm(false)}
      />
    </div>
  );
};
