import React, { useState } from 'react';
import { BookRecord } from '../types';
import { AlertTriangle, Copy, Trash2, CheckCircle2, X, ExternalLink } from 'lucide-react';
import { isBookSpinePrinted } from '../utils/spineUtils';

interface DuplicateInspectorModalProps {
  isOpen: boolean;
  books: BookRecord[];
  onClose: () => void;
  onDeleteBook: (book: BookRecord) => void;
  onMergeBooks: (keepBookId: string, removeBookId: string) => void;
  onToggleAllowDuplicate?: (book: BookRecord) => void;
  onViewBook?: (book: BookRecord) => void;
  onEditBook?: (book: BookRecord, focusField?: string) => void;
}

export const DuplicateInspectorModal: React.FC<DuplicateInspectorModalProps> = ({
  isOpen,
  books,
  onClose,
  onDeleteBook,
  onMergeBooks,
  onToggleAllowDuplicate,
  onViewBook,
  onEditBook,
}) => {
  if (!isOpen) return null;

  // Find duplicate groups
  // Group by normalized ISBN (if ISBN exists and length > 5) or normalized title
  const isbnMap = new Map<string, BookRecord[]>();
  const titleMap = new Map<string, BookRecord[]>();

  books.forEach((b) => {
    if (b.ignoreDuplicate) return; // Skip books marked as valid multiple copies
    const cleanIsbn = (b.isbn || '').replace(/[^0-9X]/gi, '').trim();
    if (cleanIsbn.length >= 8) {
      const list = isbnMap.get(cleanIsbn) || [];
      list.push(b);
      isbnMap.set(cleanIsbn, list);
    }

    const cleanTitle = (b.judul || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (cleanTitle.length > 3) {
      const list = titleMap.get(cleanTitle) || [];
      list.push(b);
      titleMap.set(cleanTitle, list);
    }
  });

  const duplicateGroups: { type: 'isbn' | 'title'; key: string; items: BookRecord[] }[] = [];

  isbnMap.forEach((items, key) => {
    if (items.length > 1) {
      duplicateGroups.push({ type: 'isbn', key, items });
    }
  });

  titleMap.forEach((items, key) => {
    if (items.length > 1) {
      // Check if not already captured by ISBN
      const alreadyCaptured = duplicateGroups.some((g) => g.items.some((it) => items.some((i) => i.id === it.id)));
      if (!alreadyCaptured) {
        duplicateGroups.push({ type: 'title', key, items });
      }
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Pemeriksa Duplikasi Katalog (Catalog Duplicate Inspector)
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Menemui <span className="font-bold text-amber-600 dark:text-amber-400">{duplicateGroups.length} kumpulan</span> buku yang mempunyai persamaan ISBN atau Tajuk.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content List */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          {duplicateGroups.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                Tiada Duplikasi Dikesan!
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Semua rekod buku dalam katalog perpustakaan anda adalah unik dan bebas daripada pertindihan ISBN atau tajuk yang seiras.
              </p>
            </div>
          ) : (
            duplicateGroups.map((group, groupIdx) => (
              <div
                key={groupIdx}
                className="p-5 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/15 space-y-4 shadow-2xs"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-bold px-3.5 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Kumpulan #{groupIdx + 1} ({group.type === 'isbn' ? `ISBN Seiras: ${group.key}` : `Tajuk Seiras`})</span>
                  </span>
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    {group.items.length} salinan bertindih
                  </span>
                </div>

                <div className="space-y-3">
                  {group.items.map((book, idx) => (
                    <div
                      key={book.id}
                      className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs hover:shadow-xs transition"
                    >
                      <div className="space-y-2 flex-1 min-w-0">
                        {/* Enlarged Badges Row */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-mono font-bold px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                            {book.nomborPerolehan || `Salinan #${idx + 1}`}
                          </span>

                          {onEditBook ? (
                            <button
                              type="button"
                              onClick={() => onEditBook(book, 'noDdc')}
                              className="text-sm font-mono font-bold px-3.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1.5 cursor-pointer group active:scale-95 shadow-2xs"
                              title="Klik untuk terus sunting No. DDC buku ini"
                            >
                              <span>DDC: {book.noDdc || '-'}</span>
                              <span className="text-xs opacity-70 group-hover:opacity-100">✏️</span>
                            </button>
                          ) : (
                            <span className="text-sm font-mono px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold">
                              DDC: {book.noDdc || '-'}
                            </span>
                          )}

                          {onEditBook ? (
                            <button
                              type="button"
                              onClick={() => onEditBook(book, 'isbn')}
                              className="text-sm font-semibold text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300 px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-700/50 dark:hover:bg-indigo-950/60 rounded-lg border border-slate-200/60 hover:border-indigo-300 dark:border-slate-700 dark:hover:border-indigo-800 transition flex items-center gap-1.5 cursor-pointer group active:scale-95 shadow-2xs"
                              title="Klik untuk terus sunting ISBN buku ini"
                            >
                              <span>ISBN: <span className="font-mono font-bold">{book.isbn || 'Tiada'}</span></span>
                              <span className="text-xs opacity-60 group-hover:opacity-100">✏️</span>
                            </button>
                          ) : (
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-2.5 py-1 bg-slate-100/80 dark:bg-slate-700/50 rounded-lg border border-slate-200/60 dark:border-slate-700">
                              ISBN: <span className="font-mono">{book.isbn || 'Tiada'}</span>
                            </span>
                          )}

                          <span className={`text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 border ${
                            book.status === 'Lengkap'
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : book.status === 'Draf'
                              ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          }`}>
                            Status: {book.status || 'Lengkap'}
                          </span>

                          {isBookSpinePrinted(book) && (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold border border-emerald-300 dark:border-emerald-700 shadow-2xs"
                              title={`Tulang buku telah dicetak${book.spinePrintedDate ? ` pada ${book.spinePrintedDate}` : ''}`}
                            >
                              <span>🏷️ Tulang Dicetak</span>
                            </span>
                          )}
                        </div>

                        {/* Title & Metadata */}
                        <div>
                          <h5 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                            {onViewBook ? (
                              <button
                                type="button"
                                onClick={() => onViewBook(book)}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition text-left flex items-center gap-2 cursor-pointer group"
                                title="Klik untuk lihat butiran & status lengkap buku ini"
                              >
                                <span>{book.judul}</span>
                                <ExternalLink className="w-4 h-4 text-indigo-500 opacity-70 group-hover:opacity-100 transition shrink-0" />
                              </button>
                            ) : (
                              <span>{book.judul}</span>
                            )}
                          </h5>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            Pengarang: <span className="font-medium text-slate-800 dark:text-slate-200">{book.pengarang || '-'}</span> • Penerbit: <span className="font-medium text-slate-800 dark:text-slate-200">{book.penerbit || '-'}</span> ({book.tahunTerbit || '-'})
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                        {onToggleAllowDuplicate && (
                          <button
                            onClick={() => onToggleAllowDuplicate(book)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Tanda bahawa ini adalah salinan fizikal sebenar yang berasingan (bukan duplikasi ralat)"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Batalkan Duplikasi</span>
                          </button>
                        )}
                        <button
                          id={`btn-delete-duplicate-${book.id}`}
                          onClick={() => onDeleteBook(book)}
                          className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/70 text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                          title="Padam salinan buku ini (Delete duplicate)"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span>Padam (Delete)</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition cursor-pointer"
          >
            Tutup Pemeriksa
          </button>
        </div>

      </div>
    </div>
  );
};
