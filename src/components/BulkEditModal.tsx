import React, { useState } from 'react';
import {
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Bookmark,
  Building2,
  MapPin,
  Calendar,
  User,
  Hash,
  FileText,
  Tag,
  Layers,
  ChevronDown,
  ChevronUp,
  Eye,
  Check,
  RotateCcw,
} from 'lucide-react';
import { BookRecord, BookStatus, AuditLog } from '../types';
import { cleanSpinePrintedCatatan, isBookSpinePrinted } from '../utils/spineUtils';

export interface BulkEditChanges {
  updateStatus: boolean;
  status: BookStatus;

  updateSpineStatus: boolean;
  spineStatus: 'telah_dicetak' | 'belum_dicetak';

  updatePublisherAndPlace: boolean;
  penerbit: string;
  tempatTerbit: string;

  updateYear: boolean;
  tahunTerbit: string;

  updateDdc: boolean;
  noDdc: string;

  updateAuthor: boolean;
  pengarang: string;

  updateAccession: boolean;
  accessionPrefix: string;
  accessionStartNumber: number;
  accessionPadding: number;

  updateCatatan: boolean;
  catatanMode: 'append' | 'replace' | 'clear';
  catatanText: string;
}

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBooks: BookRecord[];
  onApplyBulkEdit?: (
    updatedBooks: BookRecord[],
    auditLogs: AuditLog[],
    summaryMessage: string
  ) => void;
  onSave?: (
    updatedBooks: BookRecord[],
    auditLogs: AuditLog[],
    summaryMessage: string
  ) => void;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedBooks,
  onApplyBulkEdit,
  onSave,
}) => {
  // Field toggles and values state
  const [changes, setChanges] = useState<BulkEditChanges>({
    updateStatus: false,
    status: 'Lengkap',

    updateSpineStatus: false,
    spineStatus: 'telah_dicetak',

    updatePublisherAndPlace: false,
    penerbit: '',
    tempatTerbit: '',

    updateYear: false,
    tahunTerbit: String(new Date().getFullYear()),

    updateDdc: false,
    noDdc: '',

    updateAuthor: false,
    pengarang: '',

    updateAccession: false,
    accessionPrefix: 'PER-2026-',
    accessionStartNumber: 1001,
    accessionPadding: 4,

    updateCatatan: false,
    catatanMode: 'append',
    catatanText: '',
  });

  const [showPreviewList, setShowPreviewList] = useState(false);
  const [previewFilter, setPreviewFilter] = useState('');

  if (!isOpen || selectedBooks.length === 0) return null;

  // Preset constants
  const publisherPresets = [
    'Dewan Bahasa dan Pustaka (DBP)',
    'PTS Publishing House',
    'Kumpulan Media Karangkraf',
    'Sasbadi Sdn. Bhd.',
    'Penerbitan Pelangi Sdn. Bhd.',
    'Oxford Fajar',
    'Penerbit Ilham',
    'Buku Prima',
  ];

  const placePresets = [
    'Kuala Lumpur',
    'Bangi, Selangor',
    'Shah Alam, Selangor',
    'Petaling Jaya',
    'Johor Bahru',
    'Pulau Pinang',
    'Kota Bharu',
    'Kuching, Sarawak',
  ];

  const yearPresets = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];

  const ddcPresets = [
    { code: '000', label: '000 - Karya Am & Komputer' },
    { code: '100', label: '100 - Falsafah & Psikologi' },
    { code: '200', label: '200 - Agama & Ketuhanan' },
    { code: '297', label: '297 - Agama Islam' },
    { code: '300', label: '300 - Sains Sosial' },
    { code: '400', label: '400 - Bahasa & Linguistik' },
    { code: '499.23', label: '499.23 - Bahasa Melayu' },
    { code: '420', label: '420 - Bahasa Inggeris' },
    { code: '500', label: '500 - Sains Tulen' },
    { code: '600', label: '600 - Teknologi & Sains Gunaan' },
    { code: '700', label: '700 - Kesenian & Rekreasi' },
    { code: '800', label: '800 - Kesusasteraan' },
    { code: '899.233', label: '899.233 - Fiksyen Melayu' },
    { code: '823', label: '823 - Fiksyen Inggeris' },
    { code: '900', label: '900 - Sejarah & Geografi' },
    { code: '959.5', label: '959.5 - Sejarah Malaysia' },
  ];

  const catatanTagPresets = [
    '[Sumbangan PIBG]',
    '[Koleksi Khas NILAM]',
    '[Buku Rujukan Guru]',
    '[Perolehan Baharu 2026]',
    '[Siri Novel Pilihan]',
    '[Koleksi Pinjaman Terhad]',
    '[Hadiah Program Membaca]',
    '[Buku Gantian Perpustakaan]',
  ];

  // Helper to format accession number
  const formatAccessionNumber = (index: number) => {
    const num = changes.accessionStartNumber + index;
    const padded = String(num).padStart(changes.accessionPadding, '0');
    return `${changes.accessionPrefix}${padded}`;
  };

  // Helper to count active changes
  const activeFieldsCount = [
    changes.updateStatus,
    changes.updateSpineStatus,
    changes.updatePublisherAndPlace,
    changes.updateYear,
    changes.updateDdc,
    changes.updateAuthor,
    changes.updateAccession,
    changes.updateCatatan,
  ].filter(Boolean).length;

  const handleApply = () => {
    if (activeFieldsCount === 0) {
      alert('Sila tandakan sekurang-kurangnya SATU medan untuk disunting secara pukal.');
      return;
    }

    const nowStr = new Date().toLocaleString('ms-MY');
    const newAuditLogs: AuditLog[] = [];

    const updatedBooksList: BookRecord[] = selectedBooks.map((book, idx) => {
      const updated: BookRecord = { ...book };
      const bookAuditTrail: AuditLog[] = [...(book.auditTrail || [])];

      // 1. Status Rekod
      if (changes.updateStatus && book.status !== changes.status) {
        const auditItem: AuditLog = {
          id: `aud-bulk-stat-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          bookId: book.id,
          timestamp: nowStr,
          field: 'Status Rekod',
          oldValue: book.status,
          newValue: changes.status,
          source: 'Semakan Pengguna',
          user: 'Pustakawan (Suntingan Pukal)',
        };
        bookAuditTrail.push(auditItem);
        newAuditLogs.push(auditItem);
        updated.status = changes.status;
      }

      // 2. Status Cetakan Tulang
      if (changes.updateSpineStatus) {
        const isCurrentlyPrinted = isBookSpinePrinted(book);
        if (changes.spineStatus === 'telah_dicetak' && !isCurrentlyPrinted) {
          const tagNote = `[Tulang Buku Telah Dicetak pada ${nowStr}]`;
          const currentCatatan = updated.catatan || '';
          updated.spinePrinted = true;
          updated.spinePrintedDate = nowStr;
          updated.catatan = currentCatatan ? `${currentCatatan} ${tagNote}` : tagNote;

          const auditItem: AuditLog = {
            id: `aud-bulk-spine-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            bookId: book.id,
            timestamp: nowStr,
            field: 'Status Cetakan Tulang',
            oldValue: 'Belum Dicetak',
            newValue: 'Telah Dicetak',
            source: 'Semakan Pengguna',
            user: 'Pustakawan (Suntingan Pukal)',
          };
          bookAuditTrail.push(auditItem);
          newAuditLogs.push(auditItem);
        } else if (changes.spineStatus === 'belum_dicetak' && isCurrentlyPrinted) {
          updated.spinePrinted = false;
          updated.spinePrintedDate = undefined;
          updated.catatan = cleanSpinePrintedCatatan(updated.catatan || '');

          const auditItem: AuditLog = {
            id: `aud-bulk-spine-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            bookId: book.id,
            timestamp: nowStr,
            field: 'Status Cetakan Tulang',
            oldValue: 'Telah Dicetak',
            newValue: 'Belum Dicetak',
            source: 'Semakan Pengguna',
            user: 'Pustakawan (Suntingan Pukal)',
          };
          bookAuditTrail.push(auditItem);
          newAuditLogs.push(auditItem);
        }
      }

      // 3. Penerbit & Tempat Terbit
      if (changes.updatePublisherAndPlace) {
        if (changes.penerbit.trim() && changes.penerbit !== book.penerbit) {
          const auditItem: AuditLog = {
            id: `aud-bulk-pub-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            bookId: book.id,
            timestamp: nowStr,
            field: 'Penerbit',
            oldValue: book.penerbit || '(Kosong)',
            newValue: changes.penerbit.trim(),
            source: 'Semakan Pengguna',
            user: 'Pustakawan (Suntingan Pukal)',
          };
          bookAuditTrail.push(auditItem);
          newAuditLogs.push(auditItem);
          updated.penerbit = changes.penerbit.trim();
        }

        if (changes.tempatTerbit.trim() && changes.tempatTerbit !== book.tempatTerbit) {
          const auditItem: AuditLog = {
            id: `aud-bulk-place-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            bookId: book.id,
            timestamp: nowStr,
            field: 'Tempat Terbit',
            oldValue: book.tempatTerbit || '(Kosong)',
            newValue: changes.tempatTerbit.trim(),
            source: 'Semakan Pengguna',
            user: 'Pustakawan (Suntingan Pukal)',
          };
          bookAuditTrail.push(auditItem);
          newAuditLogs.push(auditItem);
          updated.tempatTerbit = changes.tempatTerbit.trim();
        }
      }

      // 4. Tahun Terbit
      if (changes.updateYear && changes.tahunTerbit.trim() && changes.tahunTerbit !== book.tahunTerbit) {
        const auditItem: AuditLog = {
          id: `aud-bulk-year-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          bookId: book.id,
          timestamp: nowStr,
          field: 'Tahun Terbit',
          oldValue: book.tahunTerbit || '(Kosong)',
          newValue: changes.tahunTerbit.trim(),
          source: 'Semakan Pengguna',
          user: 'Pustakawan (Suntingan Pukal)',
        };
        bookAuditTrail.push(auditItem);
        newAuditLogs.push(auditItem);
        updated.tahunTerbit = changes.tahunTerbit.trim();
      }

      // 5. No. DDC
      if (changes.updateDdc && changes.noDdc.trim() && changes.noDdc !== book.noDdc) {
        const auditItem: AuditLog = {
          id: `aud-bulk-ddc-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          bookId: book.id,
          timestamp: nowStr,
          field: 'No. DDC',
          oldValue: book.noDdc || '(Kosong)',
          newValue: changes.noDdc.trim(),
          source: 'Semakan Pengguna',
          user: 'Pustakawan (Suntingan Pukal)',
        };
        bookAuditTrail.push(auditItem);
        newAuditLogs.push(auditItem);
        updated.noDdc = changes.noDdc.trim();
      }

      // 6. Pengarang
      if (changes.updateAuthor && changes.pengarang.trim() && changes.pengarang !== book.pengarang) {
        const auditItem: AuditLog = {
          id: `aud-bulk-author-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          bookId: book.id,
          timestamp: nowStr,
          field: 'Pengarang',
          oldValue: book.pengarang || '(Kosong)',
          newValue: changes.pengarang.trim(),
          source: 'Semakan Pengguna',
          user: 'Pustakawan (Suntingan Pukal)',
        };
        bookAuditTrail.push(auditItem);
        newAuditLogs.push(auditItem);
        updated.pengarang = changes.pengarang.trim();
      }

      // 7. No. Perolehan Bersiri (Sequential Accession Numbering)
      if (changes.updateAccession) {
        const newAccession = formatAccessionNumber(idx);
        if (newAccession !== book.nomborPerolehan) {
          const auditItem: AuditLog = {
            id: `aud-bulk-acc-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            bookId: book.id,
            timestamp: nowStr,
            field: 'Nombor Perolehan',
            oldValue: book.nomborPerolehan || '(Kosong)',
            newValue: newAccession,
            source: 'Semakan Pengguna',
            user: 'Pustakawan (Suntingan Pukal)',
          };
          bookAuditTrail.push(auditItem);
          newAuditLogs.push(auditItem);
          updated.nomborPerolehan = newAccession;
        }
      }

      // 8. Catatan & Nota
      if (changes.updateCatatan) {
        let finalCatatan = updated.catatan || '';
        const oldCatatan = book.catatan || '(Kosong)';
        if (changes.catatanMode === 'clear') {
          finalCatatan = '';
        } else if (changes.catatanMode === 'replace') {
          finalCatatan = changes.catatanText.trim();
        } else if (changes.catatanMode === 'append') {
          const toAdd = changes.catatanText.trim();
          if (toAdd) {
            finalCatatan = finalCatatan ? `${finalCatatan} ${toAdd}` : toAdd;
          }
        }

        if (finalCatatan !== (book.catatan || '')) {
          const auditItem: AuditLog = {
            id: `aud-bulk-note-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            bookId: book.id,
            timestamp: nowStr,
            field: 'Catatan / Nota',
            oldValue: oldCatatan,
            newValue: finalCatatan || '(Dikosongkan)',
            source: 'Semakan Pengguna',
            user: 'Pustakawan (Suntingan Pukal)',
          };
          bookAuditTrail.push(auditItem);
          newAuditLogs.push(auditItem);
          updated.catatan = finalCatatan;
        }
      }

      updated.auditTrail = bookAuditTrail;
      return updated;
    });

    const summaryMsg = `✓ Berjaya mengemas kini ${selectedBooks.length} rekod buku secara serentak (${activeFieldsCount} medan disunting).`;
    if (onApplyBulkEdit) {
      onApplyBulkEdit(updatedBooksList, newAuditLogs, summaryMsg);
    } else if (onSave) {
      onSave(updatedBooksList, newAuditLogs, summaryMsg);
    }
    onClose();
  };

  const filteredPreviewBooks = selectedBooks.filter((b) => {
    if (!previewFilter) return true;
    const q = previewFilter.toLowerCase();
    return (
      b.judul.toLowerCase().includes(q) ||
      b.pengarang.toLowerCase().includes(q) ||
      (b.nomborPerolehan && b.nomborPerolehan.toLowerCase().includes(q)) ||
      (b.isbn && b.isbn.includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Suntingan Pukal Rekod Buku
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs border border-indigo-200 dark:border-indigo-800">
                  {selectedBooks.length} Buku Dipilih
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tandakan suis kotak semak bagi medan yang ingin diselaraskan. Medan tidak bertanda akan dikekalkan pada nilai asal.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup Tetingkap"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable fields and preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Active Fields Indicator Banner */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-medium">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                <strong>{activeFieldsCount}</strong> daripada 8 medan aktif untuk dikemas kini pada {selectedBooks.length} buku.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setChanges((prev) => ({
                    ...prev,
                    updateStatus: true,
                    updateSpineStatus: true,
                    updatePublisherAndPlace: true,
                    updateYear: true,
                    updateDdc: true,
                    updateAuthor: true,
                    updateAccession: true,
                    updateCatatan: true,
                  }));
                }}
                className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
              >
                Pilih Semua Medan
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={() => {
                  setChanges((prev) => ({
                    ...prev,
                    updateStatus: false,
                    updateSpineStatus: false,
                    updatePublisherAndPlace: false,
                    updateYear: false,
                    updateDdc: false,
                    updateAuthor: false,
                    updateAccession: false,
                    updateCatatan: false,
                  }));
                }}
                className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Nyahpilih Semua Medan
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* 1. Status Rekod */}
            <div className={`p-4 rounded-2xl border transition-all ${changes.updateStatus ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-75'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changes.updateStatus}
                    onChange={(e) => setChanges(p => ({ ...p, updateStatus: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Status Rekod
                  </span>
                </label>
                {changes.updateStatus && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <select
                  disabled={!changes.updateStatus}
                  value={changes.status}
                  onChange={(e) => setChanges(p => ({ ...p, status: e.target.value as BookStatus }))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                >
                  <option value="Lengkap">✓ Lengkap (Katalog Sah)</option>
                  <option value="Perlu Semakan">⚠ Perlu Semakan</option>
                  <option value="Draf">✎ Draf (Belum Disahkan)</option>
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tukar status katalog bagi semua buku terpilih secara serentak.
                </p>
              </div>
            </div>

            {/* 2. Status Cetakan Tulang */}
            <div className={`p-4 rounded-2xl border transition-all ${changes.updateSpineStatus ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-75'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changes.updateSpineStatus}
                    onChange={(e) => setChanges(p => ({ ...p, updateSpineStatus: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Status Cetakan Tulang Buku
                  </span>
                </label>
                {changes.updateSpineStatus && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!changes.updateSpineStatus}
                  onClick={() => setChanges(p => ({ ...p, spineStatus: 'telah_dicetak' }))}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    changes.spineStatus === 'telah_dicetak'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  } disabled:opacity-50`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Telah Dicetak</span>
                </button>
                <button
                  type="button"
                  disabled={!changes.updateSpineStatus}
                  onClick={() => setChanges(p => ({ ...p, spineStatus: 'belum_dicetak' }))}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    changes.spineStatus === 'belum_dicetak'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  } disabled:opacity-50`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Belum Dicetak</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Tandakan status tulang dicetak atau reset semula status dan nota berkaitan.
              </p>
            </div>

            {/* 3. Penerbit & Tempat Terbit */}
            <div className={`p-4 rounded-2xl border transition-all md:col-span-2 ${changes.updatePublisherAndPlace ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-75'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changes.updatePublisherAndPlace}
                    onChange={(e) => setChanges(p => ({ ...p, updatePublisherAndPlace: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Penerbit & Tempat Terbit
                  </span>
                </label>
                {changes.updatePublisherAndPlace && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Penerbit:
                  </label>
                  <input
                    type="text"
                    disabled={!changes.updatePublisherAndPlace}
                    value={changes.penerbit}
                    onChange={(e) => setChanges(p => ({ ...p, penerbit: e.target.value }))}
                    placeholder="Contoh: Dewan Bahasa dan Pustaka"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                  />
                  {/* Presets Penerbit */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {publisherPresets.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={!changes.updatePublisherAndPlace}
                        onClick={() => setChanges(prev => ({ ...prev, penerbit: p }))}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-40"
                      >
                        + {p.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tempat Terbit:
                  </label>
                  <input
                    type="text"
                    disabled={!changes.updatePublisherAndPlace}
                    value={changes.tempatTerbit}
                    onChange={(e) => setChanges(p => ({ ...p, tempatTerbit: e.target.value }))}
                    placeholder="Contoh: Kuala Lumpur"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                  />
                  {/* Presets Tempat */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {placePresets.slice(0, 4).map((pl) => (
                      <button
                        key={pl}
                        type="button"
                        disabled={!changes.updatePublisherAndPlace}
                        onClick={() => setChanges(prev => ({ ...prev, tempatTerbit: pl }))}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-40"
                      >
                        + {pl.split(',')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Tahun Terbit */}
            <div className={`p-4 rounded-2xl border transition-all ${changes.updateYear ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-75'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changes.updateYear}
                    onChange={(e) => setChanges(p => ({ ...p, updateYear: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Tahun Terbit
                  </span>
                </label>
                {changes.updateYear && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  disabled={!changes.updateYear}
                  value={changes.tahunTerbit}
                  onChange={(e) => setChanges(p => ({ ...p, tahunTerbit: e.target.value }))}
                  placeholder="Contoh: 2026"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                />
                <div className="flex flex-wrap gap-1">
                  {yearPresets.map((y) => (
                    <button
                      key={y}
                      type="button"
                      disabled={!changes.updateYear}
                      onClick={() => setChanges(prev => ({ ...prev, tahunTerbit: y }))}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer disabled:opacity-40 ${
                        changes.tahunTerbit === y
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Pengarang (Siri Buku Sama) */}
            <div className={`p-4 rounded-2xl border transition-all ${changes.updateAuthor ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-75'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changes.updateAuthor}
                    onChange={(e) => setChanges(p => ({ ...p, updateAuthor: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Pengarang (Siri / Koleksi Sama)
                  </span>
                </label>
                {changes.updateAuthor && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  disabled={!changes.updateAuthor}
                  value={changes.pengarang}
                  onChange={(e) => setChanges(p => ({ ...p, pengarang: e.target.value }))}
                  placeholder="Contoh: A. Samad Said, Ain Maisarah, dll"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sesuai untuk menyelaraskan nama pengarang bagi batch buku satu siri yang sama.
                </p>
              </div>
            </div>

            {/* 6. No. DDC (Kelas Perpustakaan) */}
            <div className={`p-4 rounded-2xl border transition-all md:col-span-2 ${changes.updateDdc ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-75'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changes.updateDdc}
                    onChange={(e) => setChanges(p => ({ ...p, updateDdc: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Nombor DDC (Klasifikasi Perpuluhan Dewey)
                  </span>
                </label>
                {changes.updateDdc && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  disabled={!changes.updateDdc}
                  value={changes.noDdc}
                  onChange={(e) => setChanges(p => ({ ...p, noDdc: e.target.value }))}
                  placeholder="Contoh: 899.233 SAM atau 500"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                />

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                    Pilihan Pantas Kelas DDC Utama:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-slate-100/70 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                    {ddcPresets.map((d) => (
                      <button
                        key={d.code}
                        type="button"
                        disabled={!changes.updateDdc}
                        onClick={() => setChanges(prev => ({ ...prev, noDdc: d.code }))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer disabled:opacity-40 ${
                          changes.noDdc === d.code
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700'
                        }`}
                        title={d.label}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 7. Penomboran Perolehan Bersiri (Sequential Accession Numbering) */}
            <div className={`p-4 rounded-2xl border transition-all md:col-span-2 ${changes.updateAccession ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-75'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changes.updateAccession}
                    onChange={(e) => setChanges(p => ({ ...p, updateAccession: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Penomboran Perolehan Bersiri (Sequential Accession Numbering)
                  </span>
                </label>
                {changes.updateAccession && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Awalan (Prefix):
                  </label>
                  <input
                    type="text"
                    disabled={!changes.updateAccession}
                    value={changes.accessionPrefix}
                    onChange={(e) => setChanges(p => ({ ...p, accessionPrefix: e.target.value }))}
                    placeholder="Contoh: PER-2026-"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nombor Mula:
                  </label>
                  <input
                    type="number"
                    min={1}
                    disabled={!changes.updateAccession}
                    value={changes.accessionStartNumber}
                    onChange={(e) => setChanges(p => ({ ...p, accessionStartNumber: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Digit Padding (cth: 4 = 0001):
                  </label>
                  <select
                    disabled={!changes.updateAccession}
                    value={changes.accessionPadding}
                    onChange={(e) => setChanges(p => ({ ...p, accessionPadding: parseInt(e.target.value) || 4 }))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                  >
                    <option value={1}>Tiada Padding (1, 2, 3...)</option>
                    <option value={3}>3 Digit (001, 002...)</option>
                    <option value={4}>4 Digit (0001, 0002...)</option>
                    <option value={5}>5 Digit (00001, 00002...)</option>
                    <option value={6}>6 Digit (000001, 000002...)</option>
                  </select>
                </div>
              </div>

              {changes.updateAccession && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/80 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Pratonton Penjanaan No. Perolehan ({selectedBooks.length} Buku):</span>
                  </div>
                  <div className="font-mono text-[11px] flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 font-bold">
                      Buku #1: {formatAccessionNumber(0)}
                    </span>
                    {selectedBooks.length > 1 && (
                      <>
                        <span className="text-slate-400">...</span>
                        <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 font-bold">
                          Buku #{selectedBooks.length}: {formatAccessionNumber(selectedBooks.length - 1)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 8. Catatan & Nota Rekod */}
            <div className={`p-4 rounded-2xl border transition-all md:col-span-2 ${changes.updateCatatan ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-75'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changes.updateCatatan}
                    onChange={(e) => setChanges(p => ({ ...p, updateCatatan: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Catatan & Nota Rekod
                  </span>
                </label>
                {changes.updateCatatan && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!changes.updateCatatan}
                    onClick={() => setChanges(p => ({ ...p, catatanMode: 'append' }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                      changes.catatanMode === 'append'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    + Tambah ke Belakang (Append)
                  </button>
                  <button
                    type="button"
                    disabled={!changes.updateCatatan}
                    onClick={() => setChanges(p => ({ ...p, catatanMode: 'replace' }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                      changes.catatanMode === 'replace'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    ↺ Gantikan Semua (Overwrite)
                  </button>
                  <button
                    type="button"
                    disabled={!changes.updateCatatan}
                    onClick={() => setChanges(p => ({ ...p, catatanMode: 'clear', catatanText: '' }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                      changes.catatanMode === 'clear'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    ✕ Kosongkan Catatan
                  </button>
                </div>

                {changes.catatanMode !== 'clear' && (
                  <>
                    <input
                      type="text"
                      disabled={!changes.updateCatatan}
                      value={changes.catatanText}
                      onChange={(e) => setChanges(p => ({ ...p, catatanText: e.target.value }))}
                      placeholder="Masukkan nota atau pilih tag di bawah..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                    />

                    <div className="flex flex-wrap gap-1.5">
                      {catatanTagPresets.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          disabled={!changes.updateCatatan}
                          onClick={() => {
                            setChanges(prev => {
                              const curr = prev.catatanText.trim();
                              if (curr.includes(tag)) return prev;
                              return {
                                ...prev,
                                catatanText: curr ? `${curr} ${tag}` : tag,
                              };
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-40 flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span>{tag}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Collapsible Record Inspector / Preview */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPreviewList(!showPreviewList)}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800/90 flex items-center justify-between transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  Pratonton & Senarai {selectedBooks.length} Buku Terpilih
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  (Klik untuk semak buku yang terlibat)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[11px] font-semibold">
                  {showPreviewList ? 'Sembunyikan' : 'Papar Senarai'}
                </span>
                {showPreviewList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showPreviewList && (
              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    value={previewFilter}
                    onChange={(e) => setPreviewFilter(e.target.value)}
                    placeholder="Tapis senarai buku terpilih..."
                    className="w-full max-w-xs px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                  />
                  <span className="text-[11px] text-slate-500 shrink-0">
                    Menunjukkan {filteredPreviewBooks.length} daripada {selectedBooks.length} buku
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {filteredPreviewBooks.map((b, idx) => {
                    const nextAccession = changes.updateAccession ? formatAccessionNumber(idx) : b.nomborPerolehan;
                    return (
                      <div key={b.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="font-mono text-slate-400 text-[10px] w-6 shrink-0 text-center">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {b.judul}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {b.pengarang || 'Tiada Pengarang'} • {b.penerbit || 'Tiada Penerbit'} • {b.tahunTerbit || '-'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-[11px] text-right">
                          {changes.updateAccession && (
                            <div className="font-mono">
                              <span className="text-slate-400 line-through mr-1">{b.nomborPerolehan || '-'}</span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">{nextAccession}</span>
                            </div>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {changes.updateStatus ? changes.status : b.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Perubahan akan direkodkan ke dalam <strong>Jejak Audit</strong> dan disegerakkan secara langsung.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={activeFieldsCount === 0}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Simpan & Kemas Kini ({selectedBooks.length} Rekod)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
