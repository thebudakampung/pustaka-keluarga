import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Check,
  X,
  AlertCircle,
  BookOpen,
  RefreshCw,
  Info,
} from 'lucide-react';
import { BookRecord, AISuggestion, LibrarySettings } from '../types';
import { safeFetchJson } from '../lib/apiUtils';

interface EnrichmentModalProps {
  settings?: LibrarySettings;
  book: BookRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyChanges: (
    updatedBookId: string,
    acceptedFields: Record<string, string>,
    suggestionsUsed: AISuggestion[]
  ) => void;
}

export const EnrichmentModal: React.FC<EnrichmentModalProps> = ({
  settings,
  book,
  isOpen,
  onClose,
  onApplyChanges,
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && book) {
      fetchEnrichmentData();
    } else {
      setSuggestions([]);
      setError(null);
    }
  }, [isOpen, book]);

  const fetchEnrichmentData = async () => {
    if (!book) return;
    setLoading(true);
    setError(null);

    try {
      const res = await safeFetchJson<any>('/api/ai-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book,
          aiMode: settings?.aiMode || 'jimat',
        }),
      });

      const data = res.data || {};

      if (res.ok && data.status === 'success' && Array.isArray(data.suggestions)) {
        setSuggestions(
          data.suggestions.map((s: any) => ({
            ...s,
            status: 'accepted',
          }))
        );
      } else {
        throw new Error(data.message || res.error || 'Gagal memperoleh carian metadata AI.');
      }
    } catch (err: any) {
      console.error('Enrichment Error:', err);
      setError(err.message || 'Gagal menghubungi perkhidmatan carian bibliografi.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !book) return null;

  const handleSetStatus = (field: string, newStatus: 'accepted' | 'rejected') => {
    setSuggestions((prev) =>
      prev.map((s) => (s.field === field ? { ...s, status: newStatus } : s))
    );
  };

  const handleAcceptAll = () => {
    setSuggestions((prev) => prev.map((s) => ({ ...s, status: 'accepted' })));
  };

  const handleRejectAll = () => {
    setSuggestions((prev) => prev.map((s) => ({ ...s, status: 'rejected' })));
  };

  const handleConfirmUpdates = () => {
    const acceptedFields: Record<string, string> = {};
    const acceptedSuggestions: AISuggestion[] = [];

    suggestions.forEach((s) => {
      if (s.status !== 'rejected') {
        acceptedFields[s.field] = s.suggestedValue;
        acceptedSuggestions.push({
          ...s,
          status: 'accepted',
        });
      }
    });

    onApplyChanges(book.id, acceptedFields, acceptedSuggestions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">LANGKAH 5: Pengesahan Cadangan AI / Internet</h3>
              <p className="text-xs text-slate-300">
                Buku: <strong className="text-white">{book.judul}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong>Peringatan Semakan:</strong> Maklumat yang diperoleh daripada AI atau Internet TIDAK boleh terus dikemaskini secara automatik. Sila semak perbandingan di bawah dan pilih untuk <strong>Terima</strong> atau <strong>Tolak</strong> cadangan bagi setiap medan.
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sistem sedang membuat carian metadata di Google Books, Open Library & AI Bibliografi...
              </p>
              <p className="text-[11px] text-slate-400">
                Mencari ISBN, DDC, Penerbit, dan Tahun yang lengkap.
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Semua medan utama sudah lengkap!
              </p>
              <p className="text-[11px] text-slate-500">
                Tiada cadangan baru ditemui daripada sumber bibliografi luaran.
              </p>
            </div>
          ) : (
            <>
              {/* Quick Batch Action Buttons */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {suggestions.length} Perubahan Dicadangkan
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAcceptAll}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Terima Semua</span>
                  </button>
                  <button
                    onClick={handleRejectAll}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-300 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Tolak Semua</span>
                  </button>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Medan</th>
                      <th className="py-3 px-4">Maklumat Sedia Ada</th>
                      <th className="py-3 px-4">Cadangan AI / Internet</th>
                      <th className="py-3 px-4">Sumber</th>
                      <th className="py-3 px-4 text-center">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {suggestions.map((item) => (
                      <tr
                        key={item.field}
                        className={`transition-colors ${
                          item.status === 'accepted'
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                            : item.status === 'rejected'
                            ? 'bg-rose-50/70 dark:bg-rose-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                          {item.fieldLabel}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono">
                          {item.existingValue || <span className="italic">Kosong</span>}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                          {item.suggestedValue}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium">
                            {item.source}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleSetStatus(item.field, 'accepted')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                item.status === 'accepted'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>Terima</span>
                            </button>
                            <button
                              onClick={() => handleSetStatus(item.field, 'rejected')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                item.status === 'rejected'
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                            >
                              <X className="w-3 h-3" />
                              <span>Tolak</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Batal
          </button>
          <button
            onClick={handleConfirmUpdates}
            disabled={loading || suggestions.length === 0}
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold shadow-2xs hover:opacity-90 disabled:opacity-50"
          >
            Kemaskini Katalog & Log Audit
          </button>
        </div>
      </div>
    </div>
  );
};
