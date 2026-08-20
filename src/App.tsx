import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { BookCatalog } from './components/BookCatalog';
import { AddBook } from './components/AddBook';
import { EnrichmentModal } from './components/EnrichmentModal';
import { BookDetailModal } from './components/BookDetailModal';
import { BookEditModal } from './components/BookEditModal';
import { ImportData } from './components/ImportData';
import { ExportData } from './components/ExportData';
import { SpineLabelGenerator } from './components/SpineLabelGenerator';
import { AuditTrail } from './components/AuditTrail';
import { Settings } from './components/Settings';
import { DuplicateActionModal } from './components/DuplicateActionModal';
import { DuplicateInspectorModal } from './components/DuplicateInspectorModal';
import { GitPushModal } from './components/GitPushModal';
import { initialBooks } from './data/initialBooks';
import { BookRecord, LibrarySettings, AISuggestion, AuditLog } from './types';
import { isBookSpinePrinted, cleanSpinePrintedCatatan } from './utils/spineUtils';
import { idbGet, idbSet, idbRemove } from './utils/indexedDb';
import { sortBooks } from './utils/bookSorting';
import {
  subscribeToBooks,
  saveBookToFirestore,
  saveMultipleBooksToFirestore,
  deleteBookFromFirestore,
  subscribeToSettings,
  saveSettingsToFirestore,
  subscribeToDeletedAuditLogs,
  addDeletedAuditLogToFirestore,
} from './lib/firebase';

export default function App() {
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);

  // Books State initialized from LocalStorage synchronously as fallback, then synced with IndexedDB/Firestore
  const [books, setBooks] = useState<BookRecord[]>(() => {
    const saved = localStorage.getItem('library_catalog_books');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sortBooks(parsed, 'terbaru');
        }
      } catch (e) {
        console.error('Gagal membaca rekod tempatan:', e);
      }
    }
    return sortBooks(initialBooks, 'terbaru');
  });

  // Settings State with LocalStorage & Firestore
  const [settings, setSettings] = useState<LibrarySettings>(() => {
    const saved = localStorage.getItem('library_catalog_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Gagal membaca tetapan:', e);
      }
    }
    return {
      namaPerpustakaan: 'Sistem Mini Perpustakaan AI',
      kodPerpustakaan: 'SMP-2026',
      ambangConfidence: 70,
      autoDdcSuggestion: true,
      temaWarna: 'light',
      aiMode: 'jimat',
    };
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [pendingIncomingBook, setPendingIncomingBook] = useState<BookRecord | null>(null);
  const [pendingExistingMatches, setPendingExistingMatches] = useState<BookRecord[]>([]);
  const [duplicateInspectorOpen, setDuplicateInspectorOpen] = useState(false);

  // Spine Label CSV Export Tags State
  const [spineExportTagIds, setSpineExportTagIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('library_spine_export_tags');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('library_spine_export_tags', JSON.stringify(spineExportTagIds));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [spineExportTagIds]);

  const [allowDraftSpinePrint, setAllowDraftSpinePrint] = useState<boolean>(() => {
    const saved = localStorage.getItem('library_allow_draft_spine_print');
    return saved === 'true';
  });

  useEffect(() => {
    try {
      localStorage.setItem('library_allow_draft_spine_print', String(allowDraftSpinePrint));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [allowDraftSpinePrint]);

  const handleToggleAllowDraftSpinePrint = () => {
    setAllowDraftSpinePrint((prev) => !prev);
  };

  const isUntaggableStatus = (status?: string) => {
    if (allowDraftSpinePrint) return false;
    if (!status) return false;
    const s = status.toLowerCase();
    return s === 'draf' || s === 'perlu semakan' || s === 'perlu_semakan';
  };

  // Auto-clean any tagged books that have status 'Draf' or 'Perlu Semakan'
  useEffect(() => {
    setSpineExportTagIds((prev) =>
      prev.filter((id) => {
        const b = books.find((bk) => bk.id === id);
        return !b || !isUntaggableStatus(b.status);
      })
    );
  }, [books]);

  const handleToggleSpineExportTag = (bookId: string) => {
    const targetBook = books.find((b) => b.id === bookId);
    if (targetBook && isUntaggableStatus(targetBook.status)) {
      return;
    }
    setSpineExportTagIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  };

  const handleBulkToggleSpineExportTags = (bookIds: string[], select: boolean) => {
    setSpineExportTagIds((prev) => {
      if (select) {
        const validIds = bookIds.filter((id) => {
          const b = books.find((bk) => bk.id === id);
          return !b || !isUntaggableStatus(b.status);
        });
        const uniqueNewIds = validIds.filter((id) => !prev.includes(id));
        return [...prev, ...uniqueNewIds];
      } else {
        return prev.filter((id) => !bookIds.includes(id));
      }
    });
  };

  const handleClearAllSpineExportTags = () => {
    setSpineExportTagIds([]);
  };

  // Modals state
  const [selectedBookForDetail, setSelectedBookForDetail] = useState<BookRecord | null>(null);
  const [selectedBookForEdit, setSelectedBookForEdit] = useState<BookRecord | null>(null);
  const [editFocusField, setEditFocusField] = useState<string | null>(null);

  const handleOpenEditBook = (book: BookRecord, focusField?: string) => {
    setSelectedBookForEdit(book);
    setEditFocusField(focusField || null);
  };
  const [selectedBookForEnrichment, setSelectedBookForEnrichment] = useState<BookRecord | null>(null);
  const [selectedBookForLabel, setSelectedBookForLabel] = useState<BookRecord | null>(null);
  const [bookToDelete, setBookToDelete] = useState<BookRecord | null>(null);
  const [recentlyDeletedBatch, setRecentlyDeletedBatch] = useState<{ books: BookRecord[]; timestamp: number } | null>(null);
  const [deletedAuditLogs, setDeletedAuditLogs] = useState<(AuditLog & { bookTitle: string })[]>(() => {
    const saved = localStorage.getItem('library_deleted_audit_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [isGitPushModalOpen, setIsGitPushModalOpen] = useState(false);

  const handleForceSyncToFirebase = async () => {
    try {
      setIsSyncingFirebase(true);
      await saveMultipleBooksToFirestore(books);
      await saveSettingsToFirestore(settings);
      alert(`✓ Berjaya menyimpan ${books.length} rekod katalog buku ke pangkalan data Firebase Firestore!`);
    } catch (err: any) {
      console.error('Ralat simpan ke Firebase:', err);
      alert('Ralat menyimpan ke Firebase: ' + (err?.message || 'Ralat sambungan.'));
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  // 1. Subscribe to Firebase Firestore Realtime Synchronization (Live Sync across web users)
  useEffect(() => {
    let active = true;

    const unsubscribeBooks = subscribeToBooks(
      (fbBooks) => {
        if (!active) return;
        setIsFirebaseConnected(true);
        const userCleared = localStorage.getItem('user_cleared_catalog') === 'true';

        if (fbBooks.length > 0) {
          // Firestore has records -> update state and local cache
          localStorage.removeItem('user_cleared_catalog');
          setBooks(fbBooks);
          idbSet('library_catalog_books', fbBooks);
          try {
            localStorage.setItem('library_catalog_books', JSON.stringify(fbBooks));
          } catch (e) {
            console.warn('LocalStorage error:', e);
          }
        } else if (!userCleared) {
          // Firestore is empty but user didn't clear catalog -> Seed Firestore with local/initial books
          const savedLocal = localStorage.getItem('library_catalog_books');
          let seedList = initialBooks;
          if (savedLocal) {
            try {
              const parsed = JSON.parse(savedLocal);
              if (Array.isArray(parsed) && parsed.length > 0) {
                seedList = parsed;
              }
            } catch (e) {
              console.warn('Error parsing local books:', e);
            }
          }
          saveMultipleBooksToFirestore(seedList);
          setBooks(seedList);
          idbSet('library_catalog_books', seedList);
          try {
            localStorage.setItem('library_catalog_books', JSON.stringify(seedList));
          } catch (e) {
            console.warn('LocalStorage error:', e);
          }
        } else {
          // User explicitly cleared catalog
          setBooks([]);
        }
      },
      (err) => {
        console.warn('Firebase subscription warning:', err);
        setIsFirebaseConnected(false);
      }
    );

    const unsubscribeSettings = subscribeToSettings((fbSettings) => {
      if (!active) return;
      if (fbSettings && Object.keys(fbSettings).length > 0) {
        setSettings(fbSettings);
      }
    });

    const unsubscribeAudit = subscribeToDeletedAuditLogs((fbLogs) => {
      if (!active) return;
      setDeletedAuditLogs(fbLogs);
    });

    return () => {
      active = false;
      unsubscribeBooks();
      unsubscribeSettings();
      unsubscribeAudit();
    };
  }, []);

  // Load books from IndexedDB on startup as fast cache
  useEffect(() => {
    let active = true;

    idbGet<BookRecord[]>('library_catalog_books')
      .then((idbBooks) => {
        if (!active) return;
        if (idbBooks && Array.isArray(idbBooks) && idbBooks.length > 0) {
          setBooks((current) => (current.length === 0 ? idbBooks : current));
        }
      })
      .catch((err) => {
        console.warn('Gagal membaca dari IndexedDB:', err);
      })
      .finally(() => {
        if (active) {
          setIsDbLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Sync Books to IndexedDB (and LocalStorage as fallback) ONLY after DB is loaded
  useEffect(() => {
    if (!isDbLoaded) return; // Prevent overwriting DB on initial render before hydration

    idbSet('library_catalog_books', books);

    try {
      localStorage.setItem('library_catalog_books', JSON.stringify(books));
    } catch (e) {
      console.warn('LocalStorage quota exceeded (data diselamatkan secara kekal dalam IndexedDB):', e);
    }
  }, [books, isDbLoaded]);

  // Sync Settings to LocalStorage & Dark Mode class
  useEffect(() => {
    try {
      localStorage.setItem('library_catalog_settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    if (settings.temaWarna === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  // Keyboard shortcut for quick search ('/')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setActiveTab('katalog');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handler: Save New Draft Book (LANGKAH 3 Requirement)
  const handleSaveDraftBook = (newBook: BookRecord) => {
    saveBookToFirestore(newBook);
    setBooks((prev) => sortBooks([newBook, ...prev.filter((b) => b.id !== newBook.id)], 'terbaru'));
  };

  const processBookSave = (bookToSave: BookRecord, isComplete: boolean) => {
    const nowStr = new Date().toLocaleString('ms-MY');
    const updatedBook: BookRecord = {
      ...bookToSave,
      status: isComplete ? 'Lengkap' : bookToSave.status,
      auditTrail: [
        ...(bookToSave.auditTrail || []),
        {
          id: `aud-${Date.now()}-direct`,
          bookId: bookToSave.id,
          timestamp: nowStr,
          field: 'Status',
          oldValue: 'Draf',
          newValue: isComplete ? 'Lengkap' : bookToSave.status,
          source: 'Semakan Pengguna',
          user: 'Pustakawan (Simpan Katalog)',
        },
      ],
    };

    saveBookToFirestore(updatedBook);
    setBooks((prev) => {
      const filtered = prev.filter((b) => b.id !== updatedBook.id);
      return sortBooks([updatedBook, ...filtered], 'terbaru');
    });

    alert(isComplete ? '✓ Rekod Telah Berjaya Disahkan ke Katalog Utama!' : '✓ Draf buku berjaya disimpan.');
    setActiveTab('katalog');
  };

  // Handler: Confirm Direct to Catalog (Skip AI Enrichment) with Duplicate Checking
  const handleConfirmDirectToCatalog = (book: BookRecord) => {
    const matches = books.filter(b => 
      b.id !== book.id && (
        (book.isbn && b.isbn && book.isbn.replace(/[^0-9X]/gi, '') === b.isbn.replace(/[^0-9X]/gi, '')) ||
        (b.judul.toLowerCase().trim() === book.judul.toLowerCase().trim())
      )
    );

    if (matches.length > 0) {
      setPendingIncomingBook(book);
      setPendingExistingMatches(matches);
      setDuplicateModalOpen(true);
    } else {
      processBookSave(book, true);
    }
  };

  const handleDuplicateAction = (action: 'add_copy' | 'overwrite' | 'skip') => {
    setDuplicateModalOpen(false);
    if (!pendingIncomingBook) return;

    if (action === 'skip') {
      alert('Penambahan buku dibatalkan kerana duplikasi dikesan.');
      setPendingIncomingBook(null);
      return;
    }

    if (action === 'overwrite') {
      const existing = pendingExistingMatches[0];
      const mergedBook: BookRecord = {
        ...pendingIncomingBook,
        id: existing.id,
        nomborPerolehan: existing.nomborPerolehan,
        tarikhDitambah: existing.tarikhDitambah,
        auditTrail: [
          ...(existing.auditTrail || []),
          {
            id: `aud-ovr-${Date.now()}`,
            bookId: existing.id,
            timestamp: new Date().toLocaleString('ms-MY'),
            field: 'Ganti Duplikasi',
            oldValue: existing.judul,
            newValue: pendingIncomingBook.judul,
            source: 'Semakan Pengguna',
            user: 'Pustakawan (Kemaskini Duplikasi)',
          }
        ]
      };
      processBookSave(mergedBook, true);
    } else if (action === 'add_copy') {
      const accessionNo = `PER-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const copyBook: BookRecord = {
        ...pendingIncomingBook,
        id: `book-copy-${Date.now()}`,
        nomborPerolehan: accessionNo,
        catatan: `${pendingIncomingBook.catatan || ''} [Salinan tambahan fizikal No. Perolehan: ${accessionNo}]`.trim(),
        auditTrail: [
          ...(pendingIncomingBook.auditTrail || []),
          {
            id: `aud-copy-${Date.now()}`,
            bookId: `book-copy-${Date.now()}`,
            timestamp: new Date().toLocaleString('ms-MY'),
            field: 'Salinan Fizikal',
            oldValue: 'Salinan Tunggal',
            newValue: `Salinan Tambahan (${accessionNo})`,
            source: 'Semakan Pengguna',
            user: 'Pustakawan (Salinan Baru)',
          }
        ]
      };
      processBookSave(copyBook, true);
    }
    setPendingIncomingBook(null);
  };

  // Handler: Bulk Import Books
  const handleBulkImportBooks = (importedBooks: BookRecord[]) => {
    saveMultipleBooksToFirestore(importedBooks);
    setBooks((prev) => sortBooks([...importedBooks, ...prev], 'terbaru'));
  };

  // Handler: Restore Backup
  const handleRestoreBackup = (backupData: { books: BookRecord[]; settings: LibrarySettings; deletedAuditLogs?: any[] }) => {
    saveMultipleBooksToFirestore(backupData.books);
    saveSettingsToFirestore(backupData.settings);
    setBooks(backupData.books);
    setSettings(backupData.settings);
    if (backupData.deletedAuditLogs) {
      setDeletedAuditLogs(backupData.deletedAuditLogs);
      backupData.deletedAuditLogs.forEach((log) => addDeletedAuditLogToFirestore(log));
    }
    alert(`✓ Berjaya memulihkan sandaran sistem! (${backupData.books.length} rekod buku dimuatkan).`);
  };

  // Handler: Save Edited Book
  const handleSaveEditedBook = (updatedBook: BookRecord) => {
    saveBookToFirestore(updatedBook);
    setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
    if (selectedBookForDetail?.id === updatedBook.id) {
      setSelectedBookForDetail(updatedBook);
    }
  };

  // Handler: Delete Book
  const handleDeleteBook = (book: BookRecord) => {
    setBookToDelete(book);
  };

  // Handler: Bulk Edit Books
  const handleBulkEditBooks = (
    updatedBooks: BookRecord[],
    auditLogs: AuditLog[],
    summaryMessage: string
  ) => {
    if (!updatedBooks || updatedBooks.length === 0) return;

    // 1. Batch save updated books to Firestore
    saveMultipleBooksToFirestore(updatedBooks);

    // 2. Update React State
    setBooks((prev) => {
      const updatedMap = new Map(updatedBooks.map((b) => [b.id, b]));
      return prev.map((b) => updatedMap.get(b.id) || b);
    });

    // 3. Update active detail modal if open and affected
    if (selectedBookForDetail) {
      const fresh = updatedBooks.find((b) => b.id === selectedBookForDetail.id);
      if (fresh) {
        setSelectedBookForDetail(fresh);
      }
    }

    alert(summaryMessage);
  };

  // Handler: Delete Bulk Books
  const handleDeleteBulkBooks = (booksToDelete: BookRecord[]) => {
    if (!booksToDelete || booksToDelete.length === 0) return;
    const nowStr = new Date().toLocaleString('ms-MY');
    const deleteIds = new Set(booksToDelete.map((b) => b.id));

    setRecentlyDeletedBatch({ books: booksToDelete, timestamp: Date.now() });

    const newLogs: (AuditLog & { bookTitle: string })[] = booksToDelete.map((b) => ({
      id: `aud-del-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      bookId: b.id,
      timestamp: nowStr,
      field: 'Rekod Buku',
      oldValue: `Judul: ${b.judul} (No. Perolehan: ${b.nomborPerolehan || 'Tiada'})`,
      newValue: 'Dipadam secara Pukal daripada Katalog',
      source: 'Semakan Pengguna',
      user: 'Pustakawan (Padam Pukal)',
      bookTitle: b.judul,
    }));

    booksToDelete.forEach((b) => {
      deleteBookFromFirestore(b.id);
    });
    newLogs.forEach((log) => {
      addDeletedAuditLogToFirestore(log);
    });

    setDeletedAuditLogs((prev) => [...newLogs, ...prev]);
    setBooks((prev) => prev.filter((b) => !deleteIds.has(b.id)));
    setSpineExportTagIds((prev) => prev.filter((id) => !deleteIds.has(id)));

    if (selectedBookForDetail && deleteIds.has(selectedBookForDetail.id)) {
      setSelectedBookForDetail(null);
    }
  };

  const handleConfirmDeleteBook = () => {
    if (!bookToDelete) return;
    const nowStr = new Date().toLocaleString('ms-MY');
    const deletionLog: AuditLog & { bookTitle: string } = {
      id: `aud-del-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      bookId: bookToDelete.id,
      timestamp: nowStr,
      field: 'Rekod Buku',
      oldValue: `Judul: ${bookToDelete.judul} (No. Perolehan: ${bookToDelete.nomborPerolehan})`,
      newValue: 'Dipadam daripada Katalog',
      source: 'Semakan Pengguna',
      user: 'Pustakawan (Padam Rekod)',
      bookTitle: bookToDelete.judul,
    };

    setRecentlyDeletedBatch({ books: [bookToDelete], timestamp: Date.now() });

    deleteBookFromFirestore(bookToDelete.id);
    addDeletedAuditLogToFirestore(deletionLog);

    setDeletedAuditLogs((prev) => [deletionLog, ...prev]);
    setBooks((prev) => prev.filter((b) => b.id !== bookToDelete.id));
    if (selectedBookForDetail?.id === bookToDelete.id) {
      setSelectedBookForDetail(null);
    }
    setBookToDelete(null);
  };

  const handleUndoDelete = () => {
    if (!recentlyDeletedBatch) return;
    const restored = recentlyDeletedBatch.books;
    restored.forEach((b) => {
      saveBookToFirestore(b);
    });
    setBooks((prev) => [...restored, ...prev]);
    setRecentlyDeletedBatch(null);
    alert(`✓ Berjaya memulihkan semula ${restored.length} rekod buku yang baru dipadam!`);
  };

  // LANGKAH 5 Handler: Apply Accepted AI Metadata Enrichment Changes
  const handleApplyEnrichmentChanges = (
    bookId: string,
    acceptedFields: Record<string, string>,
    acceptedSuggestions: AISuggestion[]
  ) => {
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== bookId) return b;

        const updatedAuditTrail = [...(b.auditTrail || [])];
        const nowStr = new Date().toLocaleString('ms-MY');

        acceptedSuggestions.forEach((s) => {
          updatedAuditTrail.push({
            id: `aud-${Date.now()}-${s.field}-${Math.random().toString(36).substr(2, 5)}`,
            bookId,
            timestamp: nowStr,
            field: String(s.fieldLabel || s.field),
            oldValue: String((b as any)[s.field] || s.existingValue || 'Kosong'),
            newValue: String(s.suggestedValue),
            source: (s.source as any) || 'Cadangan Gemini AI',
            user: 'Pustakawan AI (Pengesahan Pengguna)',
          });
        });

        // Update status to 'Lengkap' when confirmed
        const isNowComplete = Object.keys(acceptedFields).length > 0 || b.status === 'Lengkap';

        const updated = {
          ...b,
          ...acceptedFields,
          status: isNowComplete ? 'Lengkap' : b.status,
          auditTrail: updatedAuditTrail,
        };

        saveBookToFirestore(updated);

        if (selectedBookForDetail?.id === bookId) {
          setSelectedBookForDetail(updated);
        }

        return updated;
      })
    );
  };

  // Reset Seed Data
  const handleResetSeedData = () => {
    localStorage.removeItem('user_cleared_catalog');
    saveMultipleBooksToFirestore(initialBooks);
    setBooks(initialBooks);
    localStorage.removeItem('library_catalog_books');
    idbSet('library_catalog_books', initialBooks);
  };

  // Clear All Data
  const handleClearAllData = () => {
    localStorage.setItem('user_cleared_catalog', 'true');
    books.forEach((b) => deleteBookFromFirestore(b.id));
    setBooks([]);
    localStorage.removeItem('library_catalog_books');
    idbRemove('library_catalog_books');
  };

  // Handler: Update Settings
  const handleUpdateSettings = (newSettings: LibrarySettings) => {
    setSettings(newSettings);
    saveSettingsToFirestore(newSettings);
  };

  // Handler: Mark books as exported for spine labels
  const handleMarkSpineExported = (bookIds: string[]) => {
    const nowStr = new Date().toLocaleString('ms-MY');
    setBooks((prev) =>
      prev.map((b) => {
        if (!bookIds.includes(b.id)) return b;
        const noteText = '[Telah diproses untuk cetakan tulang buku]';
        const updatedCatatan = b.catatan ? `${b.catatan} ${noteText}` : noteText;
        const auditEntry = {
          id: `aud-spine-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          bookId: b.id,
          timestamp: nowStr,
          field: 'Cetakan Tulang Buku',
          oldValue: b.catatan || 'Belum diproses',
          newValue: 'Telah diproses untuk cetakan tulang buku',
          source: 'Eksport CSV Tulang Buku',
          user: 'Pustakawan',
        };
        const updated = {
          ...b,
          spinePrinted: true,
          spinePrintedDate: nowStr,
          catatan: updatedCatatan,
          auditTrail: [...(b.auditTrail || []), auditEntry],
        };
        saveBookToFirestore(updated);
        return updated;
      })
    );

    setSpineExportTagIds((prev) => prev.filter((id) => !bookIds.includes(id)));
  };

  // Handler: Toggle Book Spine Printed Status & Small Note
  const handleBulkToggleBookSpinePrinted = (bookIds: string[], printed: boolean) => {
    const nowStr = new Date().toLocaleString('ms-MY');
    setBooks((prev) =>
      prev.map((b) => {
        if (!bookIds.includes(b.id)) return b;
        const tagText = `[Tulang Buku Telah Dicetak pada ${nowStr}]`;
        let newCatatan = b.catatan || '';
        if (printed) {
          if (!isBookSpinePrinted(b)) {
            newCatatan = newCatatan ? `${newCatatan} ${tagText}` : tagText;
          }
        } else {
          newCatatan = cleanSpinePrintedCatatan(newCatatan);
        }

        const auditEntry = {
          id: `aud-spine-print-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          bookId: b.id,
          timestamp: nowStr,
          field: 'Status Cetakan Tulang Buku',
          oldValue: isBookSpinePrinted(b) ? 'Telah Dicetak' : 'Belum Dicetak',
          newValue: printed ? `Telah Dicetak pada ${nowStr}` : 'Nota Cetak Dipadam / Belum Dicetak',
          source: 'Semakan Pengguna',
          user: 'Pustakawan',
        };

        const updated = {
          ...b,
          spinePrinted: printed,
          spinePrintedDate: printed ? nowStr : undefined,
          catatan: newCatatan,
          auditTrail: [...(b.auditTrail || []), auditEntry],
        };

        saveBookToFirestore(updated);
        return updated;
      })
    );

    if (selectedBookForDetail && bookIds.includes(selectedBookForDetail.id)) {
      setSelectedBookForDetail((prev) =>
        prev
          ? {
              ...prev,
              spinePrinted: printed,
              spinePrintedDate: printed ? nowStr : undefined,
              catatan: printed ? prev.catatan : cleanSpinePrintedCatatan(prev.catatan),
            }
          : null
      );
    }
  };

  const handleToggleBookSpinePrinted = (bookId: string, printed: boolean) => {
    handleBulkToggleBookSpinePrinted([bookId], printed);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans antialiased transition-colors selection:bg-slate-800 selection:text-white dark:selection:bg-slate-200 dark:selection:text-slate-900">
      {/* Top Navigation Bar */}
      <Navbar
        books={books}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSearch={() => setActiveTab('katalog')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isFirebaseConnected={isFirebaseConnected}
      />

      {/* Main Layout Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col">
        {/* Primary View Content Area */}
        <main className="w-full flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <Dashboard
              books={books}
              setActiveTab={setActiveTab}
              onSelectBook={(book) => setSelectedBookForDetail(book)}
            />
          )}

          {activeTab === 'katalog' && (
            <BookCatalog
              books={books}
              spineExportTagIds={spineExportTagIds}
              onToggleSpineExportTag={handleToggleSpineExportTag}
              onToggleBulkSpineExportTags={handleBulkToggleSpineExportTags}
              onClearAllSpineExportTags={handleClearAllSpineExportTags}
              onToggleBookSpinePrinted={handleToggleBookSpinePrinted}
              onToggleBulkBookSpinePrinted={handleBulkToggleBookSpinePrinted}
              onSelectBook={(book) => setSelectedBookForDetail(book)}
              onEditBook={handleOpenEditBook}
              onDeleteBook={handleDeleteBook}
              onDeleteBulkBooks={handleDeleteBulkBooks}
              onBulkEditBooks={handleBulkEditBooks}
              onTriggerEnrichment={(book) => setSelectedBookForEnrichment(book)}
              onPrintLabel={(book) => {
                setSelectedBookForLabel(book);
                setActiveTab('cetak');
              }}
              allowDraftSpinePrint={allowDraftSpinePrint}
              onToggleAllowDraftSpinePrint={handleToggleAllowDraftSpinePrint}
              setActiveTab={setActiveTab}
              onOpenDuplicateInspector={() => setDuplicateInspectorOpen(true)}
            />
          )}

          {activeTab === 'tambah' && (
            <AddBook
              settings={settings}
              onSaveDraft={handleSaveDraftBook}
              onConfirmDirectToCatalog={handleConfirmDirectToCatalog}
              onTriggerEnrichment={(book) => setSelectedBookForEnrichment(book)}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'import' && (
            <ImportData
              onBulkImportBooks={handleBulkImportBooks}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'export' && (
            <ExportData
              books={books}
            />
          )}

          {activeTab === 'cetak' && (
            <SpineLabelGenerator
              books={books}
              selectedBook={selectedBookForLabel}
              spineExportTagIds={spineExportTagIds}
              onToggleSpineExportTag={handleToggleSpineExportTag}
              onToggleBulkSpineExportTags={handleBulkToggleSpineExportTags}
              onClearAllSpineExportTags={handleClearAllSpineExportTags}
              onToggleBookSpinePrinted={handleToggleBookSpinePrinted}
              onToggleBulkBookSpinePrinted={handleBulkToggleBookSpinePrinted}
              allowDraftSpinePrint={allowDraftSpinePrint}
              onToggleAllowDraftSpinePrint={handleToggleAllowDraftSpinePrint}
            />
          )}

          {activeTab === 'audit' && <AuditTrail books={books} deletedAuditLogs={deletedAuditLogs} />}

          {activeTab === 'tetapan' && (
            <Settings
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onResetSeedData={handleResetSeedData}
              onClearAllData={handleClearAllData}
              books={books}
              deletedAuditLogs={deletedAuditLogs}
              onRestoreBackup={handleRestoreBackup}
              onSyncToFirebase={handleForceSyncToFirebase}
              isSyncingFirebase={isSyncingFirebase}
              onOpenGitPush={() => setIsGitPushModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Modals & Dialogs */}
      <EnrichmentModal
        settings={settings}
        book={selectedBookForEnrichment}
        isOpen={!!selectedBookForEnrichment}
        onClose={() => setSelectedBookForEnrichment(null)}
        onApplyChanges={handleApplyEnrichmentChanges}
      />

      <BookDetailModal
        book={selectedBookForDetail}
        isOpen={!!selectedBookForDetail}
        onClose={() => setSelectedBookForDetail(null)}
        onToggleBookSpinePrinted={handleToggleBookSpinePrinted}
        spineExportTagIds={spineExportTagIds}
        onToggleSpineExportTag={handleToggleSpineExportTag}
        allowDraftSpinePrint={allowDraftSpinePrint}
        onTriggerEnrichment={(book) => {
          setSelectedBookForDetail(null);
          setSelectedBookForEnrichment(book);
        }}
        onPrintLabel={(book) => {
          setSelectedBookForDetail(null);
          setSelectedBookForLabel(book);
          setActiveTab('cetak');
        }}
        onEditBook={(book, focusField) => {
          setSelectedBookForDetail(null);
          handleOpenEditBook(book, focusField);
        }}
      />

      <BookEditModal
        book={selectedBookForEdit}
        isOpen={!!selectedBookForEdit}
        onClose={() => {
          setSelectedBookForEdit(null);
          setEditFocusField(null);
        }}
        onSaveBook={handleSaveEditedBook}
        focusField={editFocusField}
      />

      <DuplicateActionModal
        isOpen={duplicateModalOpen}
        incomingBook={pendingIncomingBook}
        existingMatches={pendingExistingMatches}
        onAction={handleDuplicateAction}
        onClose={() => setDuplicateModalOpen(false)}
      />

      <DuplicateInspectorModal
        isOpen={duplicateInspectorOpen}
        books={books}
        onClose={() => setDuplicateInspectorOpen(false)}
        onDeleteBook={handleDeleteBook}
        onMergeBooks={(keepId, removeId) => {
          const toRemove = books.find(b => b.id === removeId);
          if (toRemove) {
            handleDeleteBook(toRemove);
          }
        }}
        onToggleAllowDuplicate={(book) => {
          const updated = { ...book, ignoreDuplicate: !book.ignoreDuplicate };
          handleSaveEditedBook(updated);
        }}
        onViewBook={(book) => setSelectedBookForDetail(book)}
        onEditBook={handleOpenEditBook}
      />

      {/* Delete Confirmation Modal */}
      {bookToDelete && (
        <div className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Pengesahan Pemadaman Rekod
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tindakan ini tidak boleh ditarik balik.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1.5">
              <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                Adakah anda pasti untuk memadam rekod <strong>"{bookToDelete.judul}"</strong> (No Perolehan: <span className="font-mono text-emerald-600 dark:text-emerald-400">{bookToDelete.nomborPerolehan || 'Tiada'}</span>)?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBookToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBook}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-2xs hover:bg-rose-700 transition-transform active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Padam</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Undo Notification Toast */}
      {recentlyDeletedBatch && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
              🗑️
            </div>
            <div>
              <p className="font-bold text-xs">
                {recentlyDeletedBatch.books.length} rekod buku dipadam
              </p>
              <p className="text-[11px] text-slate-400">
                Anda boleh pulihkan kembali jika tersilap.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndoDelete}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>↩️ Pulihkan (Undo)</span>
            </button>
            <button
              type="button"
              onClick={() => setRecentlyDeletedBatch(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              title="Tutup"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Git Push Modal */}
      <GitPushModal
        isOpen={isGitPushModalOpen}
        onClose={() => setIsGitPushModalOpen(false)}
      />
    </div>
  );
}
