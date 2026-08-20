import React, { useState } from 'react';
import {
  Search,
  Filter,
  Grid,
  List,
  Sparkles,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus,
  Bookmark,
  X,
  RotateCcw,
  Clock,
  Edit2,
  CheckSquare,
  Square,
  Layers,
  Tag,
  ArrowUpDown,
} from 'lucide-react';
import { BookRecord, AuditLog } from '../types';
import { isBookSpinePrinted, parseDdcAndAuthorCode } from '../utils/spineUtils';
import { ConfirmModal } from './ConfirmModal';
import { BulkEditModal } from './BulkEditModal';
import { sortBooks, BookSortOption, formatBookRecordedTime } from '../utils/bookSorting';

interface BookCatalogProps {
  books: BookRecord[];
  spineExportTagIds?: string[];
  onToggleSpineExportTag?: (bookId: string) => void;
  onToggleBulkSpineExportTags?: (bookIds: string[], select: boolean) => void;
  onClearAllSpineExportTags?: () => void;
  onToggleBookSpinePrinted?: (bookId: string, printed: boolean) => void;
  onToggleBulkBookSpinePrinted?: (bookIds: string[], printed: boolean) => void;
  onSelectBook: (book: BookRecord) => void;
  onEditBook: (book: BookRecord, focusField?: string) => void;
  onDeleteBook: (book: BookRecord) => void;
  onDeleteBulkBooks?: (books: BookRecord[]) => void;
  onBulkEditBooks?: (
    updatedBooks: BookRecord[],
    auditLogs: AuditLog[],
    summaryMessage: string
  ) => void;
  onTriggerEnrichment: (book: BookRecord) => void;
  onPrintLabel: (book: BookRecord) => void;
  allowDraftSpinePrint?: boolean;
  onToggleAllowDraftSpinePrint?: () => void;
  setActiveTab: (tab: string) => void;
  onOpenDuplicateInspector?: () => void;
}

export const BookCatalog: React.FC<BookCatalogProps> = ({
  books,
  spineExportTagIds = [],
  onToggleSpineExportTag,
  onToggleBulkSpineExportTags,
  onClearAllSpineExportTags,
  onToggleBookSpinePrinted,
  onToggleBulkBookSpinePrinted,
  onSelectBook,
  onEditBook,
  onDeleteBook,
  onDeleteBulkBooks,
  onBulkEditBooks,
  onTriggerEnrichment,
  onPrintLabel,
  allowDraftSpinePrint = false,
  onToggleAllowDraftSpinePrint,
  setActiveTab,
  onOpenDuplicateInspector,
}) => {
  const isUntaggableStatus = (status?: string) => {
    if (allowDraftSpinePrint) return false;
    if (!status) return false;
    const s = status.toLowerCase();
    return s === 'draf' || s === 'perlu semakan' || s === 'perlu_semakan';
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('semua');
  const [ddcFilter, setDdcFilter] = useState<string>('semua');
  const [spineStatusFilter, setSpineStatusFilter] = useState<'semua' | 'belum_dicetak' | 'telah_dicetak' | 'ditanda'>('semua');
  const [sortBy, setSortBy] = useState<BookSortOption>('terbaru');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Unified Multi-purpose Bulk Selection State
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, ddcFilter, spineStatusFilter, sortBy]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleBulkClearSpinePrinted = (printedInFiltered: BookRecord[]) => {
    if (printedInFiltered.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Padam Status Tulang Dicetak',
      message: `Adakah anda pasti untuk memadam status 'Tulang Dicetak' bagi ${printedInFiltered.length} buku ini? Status dan penanda nota cetakan akan dibersihkan serta-merta.`,
      confirmLabel: `Padam Status (${printedInFiltered.length} Buku)`,
      onConfirm: () => {
        const bookIds = printedInFiltered.map((b) => b.id);
        if (onToggleBulkBookSpinePrinted) {
          onToggleBulkBookSpinePrinted(bookIds, false);
        } else if (onToggleBookSpinePrinted) {
          bookIds.forEach((id) => onToggleBookSpinePrinted(id, false));
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleSingleClearSpinePrinted = (book: BookRecord) => {
    setConfirmModal({
      isOpen: true,
      title: 'Padam Status Tulang Dicetak',
      message: `Adakah anda pasti untuk memadam status 'Tulang Dicetak' bagi buku "${book.judul}"?`,
      confirmLabel: 'Padam Status',
      onConfirm: () => {
        if (onToggleBookSpinePrinted) {
          onToggleBookSpinePrinted(book.id, false);
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const getDdcClass = (noDdc: string): string => {
    const clean = (noDdc || '').trim().replace(/^[^0-9]*/, ''); // strip leading letters
    if (!clean) return 'lain';
    const match = clean.match(/^\d/);
    if (match) {
      return match[0] + '00';
    }
    return 'lain';
  };

  const ddcCategories = [
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

  const getDdcCount = (classKey: string) => {
    if (classKey === 'semua') return books.length;
    return books.filter(b => getDdcClass(b.noDdc) === classKey).length;
  };

  const baseFilteredBooks = books.filter((b) => {
    const matchesSearch =
      b.judul.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.pengarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.isbn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.noDdc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.penerbit.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.tahunTerbit.includes(searchTerm);

    const matchesStatus =
      statusFilter === 'semua' || b.status.toLowerCase() === statusFilter.toLowerCase();

    const matchesDdc =
      ddcFilter === 'semua' || getDdcClass(b.noDdc) === ddcFilter;

    return matchesSearch && matchesStatus && matchesDdc;
  });

  const filteredBooks = baseFilteredBooks.filter((b) => {
    const isPrinted = isBookSpinePrinted(b);
    const matchesSpineStatus =
      spineStatusFilter === 'semua' ||
      (spineStatusFilter === 'belum_dicetak' && !isPrinted) ||
      (spineStatusFilter === 'telah_dicetak' && isPrinted) ||
      (spineStatusFilter === 'ditanda' && spineExportTagIds.includes(b.id));

    return matchesSpineStatus;
  });

  const sortedFilteredBooks = sortBooks(filteredBooks, sortBy);
  const totalPages = Math.ceil(sortedFilteredBooks.length / ITEMS_PER_PAGE) || 1;
  const paginatedBooks = sortedFilteredBooks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Selection actions
  const handleToggleSelectBook = (bookId: string) => {
    setSelectedBookIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  };

  const handleToggleSelectAllPaginated = () => {
    const paginatedIds = paginatedBooks.map((b) => b.id);
    const isAllPaginatedSelected =
      paginatedIds.length > 0 && paginatedIds.every((id) => selectedBookIds.includes(id));

    if (isAllPaginatedSelected) {
      setSelectedBookIds((prev) => prev.filter((id) => !paginatedIds.includes(id)));
    } else {
      setSelectedBookIds((prev) => Array.from(new Set([...prev, ...paginatedIds])));
    }
  };

  const handleToggleSelectAllFiltered = () => {
    const filteredIds = filteredBooks.map((b) => b.id);
    const isAllFilteredSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedBookIds.includes(id));

    if (isAllFilteredSelected) {
      setSelectedBookIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedBookIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedBookIds([]);
  };

  const handleBulkTagSpineLabels = () => {
    const targetBooks = books.filter((b) => selectedBookIds.includes(b.id));
    const taggableBooks = targetBooks.filter((b) => !isUntaggableStatus(b.status));
    const taggableIds = taggableBooks.map((b) => b.id);

    if (taggableIds.length === 0) {
      alert(
        allowDraftSpinePrint
          ? 'Tiada buku yang dipilih.'
          : 'Buku yang dipilih berstatus Draf atau Perlu Semakan. Sila dayakan "Benarkan Tanda Buku Draf" untuk menandakannya.'
      );
      return;
    }

    if (onToggleBulkSpineExportTags) {
      onToggleBulkSpineExportTags(taggableIds, true);
    } else if (onToggleSpineExportTag) {
      taggableIds.forEach((id) => onToggleSpineExportTag(id));
    }
  };

  const handleBulkUntagSpineLabels = () => {
    const targetBooks = books.filter((b) => selectedBookIds.includes(b.id));
    const targetTaggedIds = targetBooks.map((b) => b.id).filter((id) => spineExportTagIds.includes(id));

    if (targetTaggedIds.length === 0) {
      alert('Tiada buku terpilih yang sedang ditanda untuk cetakan tulang buku.');
      return;
    }

    if (onToggleBulkSpineExportTags) {
      onToggleBulkSpineExportTags(targetTaggedIds, false);
    } else if (onToggleSpineExportTag) {
      targetTaggedIds.forEach((id) => onToggleSpineExportTag(id));
    }
  };

  const handleClearAllSpineTags = () => {
    if (spineExportTagIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Nyahaktifkan Semua Tanda Cetak Tulang',
      message: `Adakah anda pasti untuk menyahaktifkan ${spineExportTagIds.length} buku yang ditanda untuk cetakan tulang buku? Rekod buku tidak akan dipadam, hanya tanda cetakan dibatalkan.`,
      confirmLabel: `Nyahaktifkan Semua (${spineExportTagIds.length} Buku)`,
      onConfirm: () => {
        if (onClearAllSpineExportTags) {
          onClearAllSpineExportTags();
        } else if (onToggleBulkSpineExportTags) {
          onToggleBulkSpineExportTags(spineExportTagIds, false);
        } else if (onToggleSpineExportTag) {
          spineExportTagIds.forEach((id) => onToggleSpineExportTag(id));
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleConfirmBulkDelete = () => {
    const targetBooks = books.filter((b) => selectedBookIds.includes(b.id));
    if (targetBooks.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Padam Senarai Buku Terpilih (Pukal)',
      message: `Adakah anda pasti untuk memadam ${targetBooks.length} rekod buku yang telah ditanda? Tindakan ini tidak boleh dibatalkan dan semua rekod ini akan dipadam daripada pangkalan data secara kekal.`,
      confirmLabel: `Padam ${targetBooks.length} Buku`,
      onConfirm: () => {
        if (onDeleteBulkBooks) {
          onDeleteBulkBooks(targetBooks);
        } else {
          targetBooks.forEach((b) => onDeleteBook(b));
        }
        setSelectedBookIds([]);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const selectedBooksObjects = books.filter((b) => selectedBookIds.includes(b.id));
  const isAllPaginatedSelected =
    paginatedBooks.length > 0 && paginatedBooks.every((b) => selectedBookIds.includes(b.id));
  const isAllFilteredSelected =
    filteredBooks.length > 0 && filteredBooks.every((b) => selectedBookIds.includes(b.id));
  const selectedOnCurrentPageCount = paginatedBooks.filter((b) => selectedBookIds.includes(b.id)).length;
  const selectedInFilteredCount = filteredBooks.filter((b) => selectedBookIds.includes(b.id)).length;

  return (
    <div className="space-y-5">
      {/* Search & Filter Header - Sleek & Compact Single-Row Toolbar */}
      <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[220px] max-w-full lg:max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari Judul, Pengarang, ISBN, DDC, Rak..."
            className="w-full pl-9 pr-3 h-9 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-colors"
          />
        </div>

        {/* Filter, Sort & Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          {/* DDC Class Filter */}
          <div className="relative flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium">
            <Bookmark className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <select
              value={ddcFilter}
              onChange={(e) => setDdcFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer pr-1 py-1"
            >
              <option value="semua">Semua DDC ({books.length})</option>
              {ddcCategories.filter(c => c.key !== 'semua').map(c => (
                <option key={c.key} value={c.key}>
                  {c.key === 'lain' ? 'Lain / Fiksi' : `Kelas ${c.key} - ${c.desc}`} ({getDdcCount(c.key)})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer pr-1 py-1"
            >
              <option value="semua">Semua Status</option>
              <option value="draf">Draf (Belum Disahkan)</option>
              <option value="perlu semakan">Perlu Semakan</option>
              <option value="lengkap">Lengkap</option>
            </select>
          </div>

          {/* Sorting Option (Default: Masa Terkini Direkod) */}
          <div className="relative flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/70 text-xs font-medium">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as BookSortOption)}
              className="bg-transparent border-none text-xs font-bold text-indigo-950 dark:text-indigo-200 focus:outline-hidden cursor-pointer pr-1 py-1"
              title="Susun urutan senarai buku"
            >
              <option value="terbaru">⏱️ Terkini direkod</option>
              <option value="terlama">⏳ Terawal direkod</option>
              <option value="judul_asc">🔤 Judul (A - Z)</option>
              <option value="judul_desc">🔤 Judul (Z - A)</option>
              <option value="pengarang_asc">👤 Pengarang (A - Z)</option>
              <option value="ddc_asc">🏷️ No. DDC (Menaik)</option>
              <option value="tahun_desc">📅 Tahun Terbit (Terbaharu)</option>
              <option value="nobil_asc">🔢 No. Perolehan Asal</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2 h-7 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title="Paparan Jadual"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2 h-7 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title="Paparan Kad Grid"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Semak Duplikasi Button */}
          {onOpenDuplicateInspector && (
            <button
              onClick={onOpenDuplicateInspector}
              className="h-9 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:bg-amber-100 dark:hover:bg-amber-900/50 transition cursor-pointer shrink-0"
              title="Semak dan urus duplikasi buku dalam katalog"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Semak Duplikasi</span>
            </button>
          )}
        </div>
      </div>



      {/* Compact Unified Toolbar for Spine Status Filtering & Bulk Actions */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Spine Status Filter Tabs & Summary */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Tapis:</span>
          <button
            type="button"
            onClick={() => setSpineStatusFilter('semua')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              spineStatusFilter === 'semua'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            Semua ({books.filter(b => {
              const matchesSearch =
                b.judul.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.pengarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.isbn.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.noDdc.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.penerbit.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.tahunTerbit.includes(searchTerm);
              const matchesStatus = statusFilter === 'semua' || b.status.toLowerCase() === statusFilter.toLowerCase();
              const matchesDdc = ddcFilter === 'semua' || getDdcClass(b.noDdc) === ddcFilter;
              return matchesSearch && matchesStatus && matchesDdc;
            }).length})
          </button>
          <button
            type="button"
            onClick={() => setSpineStatusFilter('belum_dicetak')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              spineStatusFilter === 'belum_dicetak'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Belum ({books.filter(b => {
              const matchesSearch =
                b.judul.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.pengarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.isbn.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.noDdc.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.penerbit.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.tahunTerbit.includes(searchTerm);
              const matchesStatus = statusFilter === 'semua' || b.status.toLowerCase() === statusFilter.toLowerCase();
              const matchesDdc = ddcFilter === 'semua' || getDdcClass(b.noDdc) === ddcFilter;
              const isExcludedStatus = b.status && (b.status.toLowerCase() === 'draf' || b.status.toLowerCase() === 'perlu semakan' || b.status.toLowerCase() === 'perlu_semakan');
              return matchesSearch && matchesStatus && matchesDdc && !isBookSpinePrinted(b) && !isExcludedStatus;
            }).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSpineStatusFilter('telah_dicetak')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              spineStatusFilter === 'telah_dicetak'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Telah ({books.filter(b => {
              const matchesSearch =
                b.judul.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.pengarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.isbn.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.noDdc.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.penerbit.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.tahunTerbit.includes(searchTerm);
              const matchesStatus = statusFilter === 'semua' || b.status.toLowerCase() === statusFilter.toLowerCase();
              const matchesDdc = ddcFilter === 'semua' || getDdcClass(b.noDdc) === ddcFilter;
              return matchesSearch && matchesStatus && matchesDdc && isBookSpinePrinted(b);
            }).length})</span>
          </button>

          {/* New: Ditanda untuk Cetak filter button */}
          <button
            type="button"
            onClick={() => setSpineStatusFilter('ditanda')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              spineStatusFilter === 'ditanda'
                ? 'bg-indigo-700 text-white shadow-xs ring-2 ring-indigo-300 dark:ring-indigo-700'
                : 'bg-slate-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50'
            }`}
            title="Tapis katalog untuk menunjukkan rekod yang sedang ditanda untuk cetakan tulang"
          >
            <Bookmark className="w-3.5 h-3.5 fill-current" />
            <span>Ditanda Cetak ({spineExportTagIds.length})</span>
          </button>
        </div>

        {/* Right: Bulk Selection & Export Tools */}
        {filteredBooks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-end">
            {onToggleAllowDraftSpinePrint && (
              <button
                type="button"
                onClick={onToggleAllowDraftSpinePrint}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  allowDraftSpinePrint
                    ? 'bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-300 dark:ring-amber-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80'
                }`}
                title="Tekan untuk membolehkan atau menyekat penandaan buku berstatus Draf untuk cetak tulang buku"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{allowDraftSpinePrint ? '✓ Cetak Draf Aktif' : 'Benarkan Tanda Buku Draf'}</span>
              </button>
            )}

            {/* Quick Bulk Selection: Pilih Halaman Semasa */}
            <button
              type="button"
              onClick={handleToggleSelectAllPaginated}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer ${
                isAllPaginatedSelected
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
              }`}
              title="Pilih atau nyahpilih semua buku pada halaman paparan ini"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Halaman ({paginatedBooks.length})</span>
            </button>

            {/* Quick Bulk Selection: Pilih Semua Ditapis (Merentasi Halaman) */}
            <button
              type="button"
              onClick={handleToggleSelectAllFiltered}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer ${
                isAllFilteredSelected
                  ? 'bg-indigo-700 text-white ring-2 ring-indigo-300 dark:ring-indigo-800'
                  : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
              }`}
              title="Pilih keseluruhan buku yang sepadan dengan carian dan tapisan semasa merentasi semua halaman"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Semua Ditapis ({filteredBooks.length})</span>
            </button>

            {/* Clear Selection Button */}
            {selectedBookIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-400 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                title="Kosongkan semua pilihan"
              >
                <X className="w-3.5 h-3.5" />
                <span>Nyahpilih ({selectedBookIds.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Persistent Dedicated Notification Banner for Tagged Spine Books */}
      {spineExportTagIds.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/90 dark:border-indigo-800/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bookmark className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-indigo-950 dark:text-indigo-100 text-sm">
                  {spineExportTagIds.length} Buku Ditanda Untuk Cetak Tulang Buku
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-200/70 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-bold text-[10px]">
                  Aktif
                </span>
              </div>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300/80 mt-0.5">
                Buku-buku ini telah dimasukkan ke dalam senarai cetakan stiker label tulang buku.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setSpineStatusFilter('ditanda')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                spineStatusFilter === 'ditanda'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50'
              }`}
              title="Papar hanya buku yang ditanda dalam senarai katalog"
            >
              <span>🔍 Lihat Ditanda ({spineExportTagIds.length})</span>
            </button>

            {/* Main Button: Nyahaktifkan Semua Ditanda Cetak Tulang */}
            <button
              type="button"
              onClick={handleClearAllSpineTags}
              className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-bold text-xs border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Nyahaktifkan dan batalkan semua tanda cetak tulang buku serta-merta"
            >
              <X className="w-3.5 h-3.5" />
              <span>Nyahaktifkan Semua Tanda ({spineExportTagIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cetak')}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Pergi ke skrin cetak label tulang"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Label</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Sticky Bulk Action Bar */}
      {selectedBookIds.length > 0 && (
        <div className="sticky top-4 z-30 p-4 rounded-2xl bg-slate-900 dark:bg-indigo-950 text-white shadow-2xl border border-slate-700/60 dark:border-indigo-800/80 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-md">
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-sm text-white">
                  {selectedBookIds.length} Rekod Buku Dipilih
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 font-mono text-[11px] border border-indigo-400/30">
                  {selectedOnCurrentPageCount} di halaman ini • {selectedInFilteredCount} dalam tapisan
                </span>
              </div>
              <p className="text-xs text-slate-300 dark:text-indigo-200/80 mt-0.5">
                Pilih tindakan pukal untuk digunakan serentak pada semua buku yang ditandakan.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* 1. Sunting Pukal (Bulk Edit) */}
            <button
              type="button"
              onClick={() => setIsBulkEditOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Buka tetingkap suntingan pukal untuk memilih medan yang ingin dikemas kini"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>✏️ Sunting Pukal</span>
            </button>

            {/* 2. Tanda Cetak Tulang Pukal */}
            <button
              type="button"
              onClick={handleBulkTagSpineLabels}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Tanda semua buku terpilih untuk eksport / cetakan label tulang buku"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>🏷️ Tanda Cetak Tulang</span>
            </button>

            {/* 3. Nyahaktifkan Tanda Cetak Tulang Pukal */}
            <button
              type="button"
              onClick={handleBulkUntagSpineLabels}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Nyahaktifkan / buang penanda cetak tulang buku bagi semua rekod terpilih"
            >
              <X className="w-3.5 h-3.5" />
              <span>🏷️ Nyahaktif Tanda Cetak</span>
            </button>

            {/* 4. Padam Pukal */}
            <button
              type="button"
              onClick={handleConfirmBulkDelete}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Padam semua buku terpilih daripada pangkalan data"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>🗑️ Padam Pukal</span>
            </button>

            {/* 5. Nyahpilih */}
            <button
              type="button"
              onClick={handleClearSelection}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
              title="Batal pemilihan semua buku"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* Catalog Results Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Menunjukkan <strong className="text-slate-900 dark:text-slate-100">{filteredBooks.length}</strong> daripada{' '}
          {books.length} rekod buku
        </span>
        <div className="flex items-center gap-3">
          {ddcFilter !== 'semua' && (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Bookmark className="w-3 h-3 fill-current" />
              <span>DDC: {ddcCategories.find(c => c.key === ddcFilter)?.desc || ddcFilter}</span>
            </span>
          )}
          {statusFilter !== 'semua' && (
            <span className="text-amber-600 dark:text-amber-400 font-bold">
              Status: {statusFilter}
            </span>
          )}
        </div>
      </div>

      {/* View Mode: Table View */}
      {viewMode === 'table' ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="max-h-[650px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs relative">
               <thead className="bg-slate-50 dark:bg-slate-800/95 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 backdrop-blur-md">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllPaginatedSelected}
                      onChange={handleToggleSelectAllPaginated}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title="Pilih / nyahpilih semua buku pada halaman paparan ini"
                    />
                  </th>
                  <th className="py-2.5 px-3 w-10 text-center">Bil</th>
                  <th className="py-2.5 px-3 w-12">Kulit</th>
                  <th className="py-2.5 px-3 max-w-[220px]">Judul Buku & Pengarang</th>
                  <th className="py-2.5 px-3">Penerbit & Tahun</th>
                  <th className="py-2.5 px-3 font-mono">ISBN</th>
                  <th className="py-2.5 px-3 font-mono">No. DDC</th>
                  <th className="py-2.5 px-3 font-mono">Huruf Pengarang</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {paginatedBooks.map((book, idx) => {
                  const isTagged = spineExportTagIds.includes(book.id);
                  const isSelected = selectedBookIds.includes(book.id);
                  const { ddcOnly, authorCode } = parseDdcAndAuthorCode(book.noDdc, book.pengarang);
                  const absoluteIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  return (
                  <tr
                    key={book.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group ${isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectBook(book.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Tanda buku ini untuk tindakan pukal"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">{absoluteIdx}</td>
                    <td className="py-2.5 px-3">
                      <div className="w-8 h-11 rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        {book.urlGambarKulit ? (
                          <img
                            src={book.urlGambarKulit}
                            alt={book.judul}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400 text-center p-0.5 leading-tight">
                            Tiada
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        {idx === 0 && currentPage === 1 && sortBy === 'terbaru' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-extrabold text-[9px] border border-indigo-200 dark:border-indigo-800 shrink-0">
                            ✨ Terkini
                          </span>
                        )}
                        <div
                          onClick={() => onSelectBook(book)}
                          className="font-semibold text-slate-900 dark:text-slate-100 hover:underline cursor-pointer truncate"
                          title={book.judul}
                        >
                          {book.judul}
                        </div>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate" title={book.pengarang}>
                        {book.pengarang || 'Pengarang Tidak Nyata'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-800 dark:text-slate-200 truncate max-w-[140px]" title={book.penerbit}>{book.penerbit || '-'}</div>
                      <div className="text-slate-400 text-[10px] flex items-center gap-1 mt-0.5" title={`Direkod pada: ${formatBookRecordedTime(book)}`}>
                        <span>{book.tahunTerbit || '-'}</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[9px] flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatBookRecordedTime(book)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {onEditBook ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditBook(book, 'isbn');
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/70 text-indigo-800 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 transition font-bold cursor-pointer group hover:shadow-2xs active:scale-95 text-left"
                          title="Klik untuk terus ubah / sunting ISBN buku ini"
                        >
                          <span className="truncate max-w-[120px]">{book.isbn || 'Tiada'}</span>
                          <Edit2 className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300">
                          {book.isbn || <span className="text-slate-400 italic">-</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {onEditBook ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditBook(book, 'noDdc');
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 transition font-bold cursor-pointer group hover:shadow-2xs active:scale-95"
                          title="Klik untuk terus ubah / sunting No. DDC buku ini"
                        >
                          <span>{ddcOnly !== '-' ? ddcOnly : '-'}</span>
                          <Edit2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">
                          {ddcOnly !== '-' ? ddcOnly : <span className="text-slate-400 italic">-</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 dark:text-indigo-400 text-[11px] uppercase">
                      {authorCode !== '-' ? authorCode : <span className="text-slate-400 italic">-</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                            book.status === 'Lengkap'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : book.status === 'Draf'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {book.status === 'Lengkap' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {book.status === 'Draf' && <FileText className="w-2.5 h-2.5" />}
                          {book.status === 'Perlu Semakan' && <AlertCircle className="w-2.5 h-2.5" />}
                          <span>{book.status}</span>
                        </span>
                        {isBookSpinePrinted(book) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[9px] font-extrabold border border-emerald-200 dark:border-emerald-800 shadow-2xs" title={`Tulang buku telah dicetak pada ${book.spinePrintedDate || '-'}`}>
                            <span>🏷️ Tulang Dicetak</span>
                            {onToggleBookSpinePrinted && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSingleClearSpinePrinted(book);
                                }}
                                className="ml-0.5 p-0.5 hover:bg-rose-200 dark:hover:bg-rose-900/80 hover:text-rose-700 dark:hover:text-rose-200 rounded transition-colors cursor-pointer"
                                title="Padam status Tulang Dicetak"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            if (isUntaggableStatus(book.status)) return;
                            onToggleSpineExportTag && onToggleSpineExportTag(book.id);
                          }}
                          disabled={isUntaggableStatus(book.status)}
                          className={`p-1 rounded-lg transition-colors flex items-center gap-1 ${
                            isUntaggableStatus(book.status)
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                              : isTagged
                              ? 'bg-indigo-600 text-white font-bold cursor-pointer'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer'
                          }`}
                          title={
                            isUntaggableStatus(book.status)
                              ? `Buku berstatus '${book.status}' tidak boleh ditanda. Klik 'Benarkan Tanda Buku Draf' di atas untuk membolehkan cetakan.`
                              : isTagged
                              ? 'Ditanda untuk Cetak Tulang Buku (Klik untuk Nyahaktifkan)'
                              : 'Tanda untuk Cetak Tulang Buku'
                          }
                        >
                          <Bookmark className={`w-3 h-3 ${isTagged && !isUntaggableStatus(book.status) ? 'fill-current' : ''}`} />
                        </button>

                        {onEditBook && (
                          <button
                            onClick={() => onEditBook(book)}
                            className="p-1 rounded-lg text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                            title="Sunting Rekod Buku"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}

                        <button
                          onClick={() => onPrintLabel(book)}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Cetak Label Tulang Buku"
                        >
                          <Printer className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteBook(book)}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          title="Padam Buku"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* View Mode: Grid View Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedBooks.map((book, idx) => {
            const isTagged = spineExportTagIds.includes(book.id);
            const isSelected = selectedBookIds.includes(book.id);
            const { ddcOnly, authorCode } = parseDdcAndAuthorCode(book.noDdc, book.pengarang);
            const absoluteIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
            return (
            <div
              key={book.id}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-200/80 dark:border-slate-800'} shadow-xs flex flex-col justify-between transition-all hover:shadow-sm relative`}
            >
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleSelectBook(book.id)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4 shadow-2xs"
                  title="Tanda buku ini untuk tindakan pukal"
                />
                <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/90 px-1.5 py-0.5 rounded">
                  #{absoluteIdx}
                </span>
                {idx === 0 && currentPage === 1 && sortBy === 'terbaru' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-extrabold text-[9px] border border-indigo-200 dark:border-indigo-800">
                    ✨ Terkini
                  </span>
                )}
              </div>
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => {
                    if (isUntaggableStatus(book.status)) return;
                    onToggleSpineExportTag && onToggleSpineExportTag(book.id);
                  }}
                  disabled={isUntaggableStatus(book.status)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                    isUntaggableStatus(book.status)
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                      : isTagged
                      ? 'bg-indigo-600 text-white shadow-xs cursor-pointer'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer'
                  }`}
                  title={
                    isUntaggableStatus(book.status)
                      ? `Buku berstatus '${book.status}' tidak boleh ditanda. Klik 'Benarkan Tanda Buku Draf' di atas untuk membolehkan cetakan.`
                      : isTagged
                      ? 'Ditanda untuk Cetak Tulang Buku (Klik untuk Nyahaktifkan)'
                      : 'Tanda untuk Cetak Tulang Buku'
                  }
                >
                  <Bookmark className={`w-3 h-3 ${isTagged && !isUntaggableStatus(book.status) ? 'fill-current' : ''}`} />
                  <span>{isTagged && !isUntaggableStatus(book.status) ? 'Ditanda (Nyahaktif)' : 'Tanda'}</span>
                </button>
              </div>
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-16 h-22 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs">
                    {book.urlGambarKulit ? (
                      <img
                        src={book.urlGambarKulit}
                        alt={book.judul}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 text-center p-1">
                        Tiada Gambar
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col items-start gap-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        book.status === 'Lengkap'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : book.status === 'Draf'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {book.status}
                    </span>
                    {isBookSpinePrinted(book) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[9px] font-extrabold border border-emerald-200 dark:border-emerald-800 shadow-2xs" title={`Tulang buku telah dicetak pada ${book.spinePrintedDate || '-'}`}>
                        <span>🏷️ Tulang Dicetak</span>
                        {onToggleBookSpinePrinted && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSingleClearSpinePrinted(book);
                            }}
                            className="ml-0.5 p-0.5 hover:bg-rose-200 dark:hover:bg-rose-900/80 hover:text-rose-700 dark:hover:text-rose-200 rounded transition-colors cursor-pointer"
                            title="Padam status Tulang Dicetak"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </span>
                    )}
                    <h3
                      onClick={() => onSelectBook(book)}
                      className="font-bold text-xs text-slate-900 dark:text-slate-100 hover:underline cursor-pointer line-clamp-2 leading-snug mt-1"
                    >
                      {book.judul}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {book.pengarang || 'Pengarang Tidak Nyata'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 py-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>ISBN:</span>
                    {onEditBook ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditBook(book, 'isbn');
                        }}
                        className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/70 px-1.5 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/80 transition cursor-pointer flex items-center gap-1 group active:scale-95"
                        title="Klik untuk terus ubah / sunting ISBN buku ini"
                      >
                        <span className="truncate max-w-[130px]">{book.isbn || '-'}</span>
                        <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity text-indigo-600 dark:text-indigo-400 shrink-0" />
                      </button>
                    ) : (
                      <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                        {book.isbn || '-'}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>No. DDC:</span>
                    {onEditBook ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditBook(book, 'noDdc');
                        }}
                        className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 px-1.5 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800/80 transition cursor-pointer flex items-center gap-1 group active:scale-95"
                        title="Klik untuk terus ubah / sunting No. DDC buku ini"
                      >
                        <span>{ddcOnly !== '-' ? ddcOnly : '-'}</span>
                        <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity text-emerald-600 dark:text-emerald-400" />
                      </button>
                    ) : (
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {ddcOnly}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Huruf Pengarang:</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                      {authorCode}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-[10px] text-slate-400">
                <div className="flex items-center gap-1 font-mono" title={`Direkod pada: ${formatBookRecordedTime(book)}`}>
                  <Clock className="w-2.5 h-2.5 text-indigo-500" />
                  <span className="truncate max-w-[120px]">{formatBookRecordedTime(book)}</span>
                </div>

                <div className="flex items-center gap-1">
                  {onEditBook && (
                    <button
                      onClick={() => onEditBook(book)}
                      className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                      title="Sunting Rekod Buku"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onPrintLabel(book)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Cetak Label"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteBook(book)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                    title="Padam Buku"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-xs">
          <span className="text-slate-500">
            Halaman <strong className="text-slate-900 dark:text-slate-100">{currentPage}</strong> daripada{' '}
            <strong className="text-slate-900 dark:text-slate-100">{totalPages}</strong> ({filteredBooks.length} jumlah rekod)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              Sebelumnya
            </button>
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, idx, arr) => {
                  const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center ${
                          currentPage === p
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              Seterusnya
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel || 'Ya, Teruskan'}
        variant="warning"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={isBulkEditOpen}
        selectedBooks={selectedBooksObjects}
        onClose={() => setIsBulkEditOpen(false)}
        onSave={(updatedBooks, auditLogs, summaryMessage) => {
          if (onBulkEditBooks) {
            onBulkEditBooks(updatedBooks, auditLogs, summaryMessage);
          }
          setIsBulkEditOpen(false);
          setSelectedBookIds([]);
        }}
      />
    </div>
  );
};
