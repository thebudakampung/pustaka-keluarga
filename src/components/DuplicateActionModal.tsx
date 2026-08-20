import React from 'react';
import { BookRecord } from '../types';
import { AlertTriangle, Copy, RefreshCw, XCircle, CheckCircle, BookOpen } from 'lucide-react';
import { isBookSpinePrinted } from '../utils/spineUtils';

interface DuplicateActionModalProps {
  isOpen: boolean;
  incomingBook: BookRecord | null;
  existingMatches: BookRecord[];
  onAction: (action: 'add_copy' | 'overwrite' | 'skip') => void;
  onClose: () => void;
}

export const DuplicateActionModal: React.FC<DuplicateActionModalProps> = ({
  isOpen,
  incomingBook,
  existingMatches,
  onAction,
  onClose,
}) => {
  if (!isOpen || !incomingBook) return null;

  const existing = existingMatches[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/50 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-amber-900 dark:text-amber-200">
              Pengesanan Duplikasi Buku (Duplicate Detected)
            </h3>
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              Sistem mendapati buku ini mempunyai ISBN atau tajuk yang sama dengan rekod sedia ada dalam katalog. Sila pilih tindakan yang ingin dilakukan.
            </p>
          </div>
        </div>

        {/* Content Comparison */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Incoming Book */}
            <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                  Buku Baharu (Incoming)
                </span>
                <span className="text-xs font-mono font-semibold text-slate-500">{incomingBook.isbn || 'Tiada ISBN'}</span>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug">
                {incomingBook.judul}
              </h4>
              <div className="space-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                <p><span className="font-medium text-slate-800 dark:text-slate-200">Pengarang:</span> {incomingBook.pengarang}</p>
                <p><span className="font-medium text-slate-800 dark:text-slate-200">Penerbit:</span> {incomingBook.penerbit || '-'} ({incomingBook.tahunTerbit || '-'})</p>
                <p><span className="font-medium text-slate-800 dark:text-slate-200">No. DDC:</span> <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{incomingBook.noDdc || '-'}</span></p>
              </div>
            </div>

            {/* Existing Book */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
                  Dalam Katalog Sedia Ada
                </span>
                <span className="text-xs font-mono font-semibold text-slate-500">{existing?.isbn || 'Tiada ISBN'}</span>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug">
                {existing?.judul}
              </h4>
              <div className="space-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                <p><span className="font-medium text-slate-800 dark:text-slate-200">Pengarang:</span> {existing?.pengarang}</p>
                <p><span className="font-medium text-slate-800 dark:text-slate-200">No. Perolehan:</span> <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{existing?.nomborPerolehan || '-'}</span></p>
                <p><span className="font-medium text-slate-800 dark:text-slate-200">Tarikh Ditambah:</span> {existing?.tarikhDitambah || '-'}</p>
              </div>
              {existing && isBookSpinePrinted(existing) && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold border border-emerald-300 dark:border-emerald-700">
                    <span>🏷️ Tulang Dicetak</span>
                  </span>
                </div>
              )}
            </div>

          </div>

          <div className="p-5 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Pilihan Tindakan Duplikasi (Action Options):
            </h5>
            <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc list-inside">
              <li><strong className="text-slate-900 dark:text-white">Tambah Sebagai Salinan Lain (Multiple Copy):</strong> Mengekalkan rekod lama dan menambah buku ini sebagai salinan fizikal berasingan (No. Perolehan baru).</li>
              <li><strong className="text-slate-900 dark:text-white">Kemaskini Rekod Sedia Ada (Overwrite):</strong> Mengemas kini butiran rekod lama dengan maklumat daripada buku baharu ini.</li>
              <li><strong className="text-slate-900 dark:text-white">Abaikan / Batal (Skip):</strong> Membatalkan penambahan buku ini untuk mengelakkan penduaan katalog.</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={() => onAction('skip')}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition flex items-center gap-2 cursor-pointer"
          >
            <XCircle className="w-4 h-4 text-slate-500" />
            Abaikan (Skip)
          </button>
          
          <button
            onClick={() => onAction('overwrite')}
            className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs sm:text-sm font-semibold transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-amber-600" />
            Kemaskini Sedia Ada
          </button>

          <button
            onClick={() => onAction('add_copy')}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Copy className="w-4 h-4" />
            Tambah Sebagai Salinan Baru
          </button>
        </div>

      </div>
    </div>
  );
};
