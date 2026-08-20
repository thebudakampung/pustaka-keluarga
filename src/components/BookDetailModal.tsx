import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Printer,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileText,
  History,
  Layers,
  MapPin,
  Bookmark,
  Link as LinkIcon,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { BookRecord } from '../types';
import { isBookSpinePrinted, parseDdcAndAuthorCode } from '../utils/spineUtils';
import { ConfirmModal } from './ConfirmModal';

interface BookDetailModalProps {
  book: BookRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onTriggerEnrichment: (book: BookRecord) => void;
  onPrintLabel: (book: BookRecord) => void;
  onEditBook: (book: BookRecord, focusField?: string) => void;
  onToggleBookSpinePrinted?: (bookId: string, printed: boolean) => void;
  spineExportTagIds?: string[];
  onToggleSpineExportTag?: (bookId: string) => void;
  allowDraftSpinePrint?: boolean;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  onClose,
  onTriggerEnrichment,
  onPrintLabel,
  onEditBook,
  onToggleBookSpinePrinted,
  spineExportTagIds = [],
  onToggleSpineExportTag,
  allowDraftSpinePrint = false,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [imageError, setImageError] = useState<boolean>(false);

  useEffect(() => {
    if (book) {
      setCustomImageUrl(book.urlGambarKulit || '');
      setImageError(false);
    }
  }, [book]);

  if (!isOpen || !book) return null;

  const isTagged = spineExportTagIds.includes(book.id);
  const isUntaggableStatus = !allowDraftSpinePrint && book.status && (
    book.status.toLowerCase() === 'draf' ||
    book.status.toLowerCase() === 'perlu semakan' ||
    book.status.toLowerCase() === 'perlu_semakan'
  );

  const { ddcOnly, authorCode } = parseDdcAndAuthorCode(book.noDdc, book.pengarang);
  const displayCoverUrl = customImageUrl.trim();

  const handleSaveCustomImageUrl = () => {
    const updatedBook: BookRecord = {
      ...book,
      urlGambarKulit: displayCoverUrl,
      auditTrail: [
        ...(book.auditTrail || []),
        {
          id: `aud-${Date.now()}-imgurl`,
          bookId: book.id,
          timestamp: new Date().toLocaleString('ms-MY'),
          field: 'Gambar Muka Depan',
          oldValue: book.urlGambarKulit ? 'Gambar Terdahulu' : 'Tiada Gambar',
          newValue: 'Kemaskini daripada Link Direct URL',
          source: 'Semakan Pengguna',
          user: 'Pustakawan',
        },
      ],
    };
    onEditBook(updatedBook);
  };

  const handleEditBookClick = () => {
    const updatedBook: BookRecord = {
      ...book,
      urlGambarKulit: displayCoverUrl || book.urlGambarKulit || '',
    };
    onEditBook(updatedBook);
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
          {/* Header */}
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  book.status === 'Lengkap'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : book.status === 'Draf'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                Status: {book.status}
              </span>
              {isBookSpinePrinted(book) && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold flex items-center gap-1.5">
                  <span>🏷️ Tulang Dicetak</span>
                  {onToggleBookSpinePrinted && (
                    <button
                      type="button"
                      onClick={() => setShowConfirm(true)}
                      className="ml-1 px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition-all cursor-pointer"
                      title="Padam Status Tulang Dicetak"
                    >
                      Padam
                    </button>
                  )}
                </span>
              )}
            <span className="text-xs text-slate-400 font-mono">
              Perolehan: {book.nomborPerolehan}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Main Book Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Book Cover / Images */}
            <div className="space-y-3">
              <div className="aspect-3/4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-md flex items-center justify-center relative">
                {displayCoverUrl && !imageError ? (
                  <img
                    src={displayCoverUrl}
                    alt={book.judul}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="text-xs text-slate-400 text-center p-4 space-y-1">
                    <ImageIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                    <p className="font-semibold text-slate-500 dark:text-slate-400">
                      {imageError ? 'Gagal Memuat Imej / Pautan Rosak' : 'Tiada Gambar Muka Depan'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Masukkan link URL gambar di bawah untuk paparan automatik
                    </p>
                  </div>
                )}
              </div>

              {/* Direct Image URL Input Box */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Link Direct URL Gambar Muka Depan:</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={customImageUrl}
                    onChange={(e) => {
                      setCustomImageUrl(e.target.value);
                      setImageError(false);
                    }}
                    placeholder="Tampal link gambar (cth: https://.../image.jpg)"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {customImageUrl.trim() !== (book.urlGambarKulit || '') && (
                    <button
                      type="button"
                      onClick={handleSaveCustomImageUrl}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      title="Simpan Link Sebagai Gambar Muka Depan"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan</span>
                    </button>
                  )}
                </div>
                {customImageUrl.trim() && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 leading-tight">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>Gambar dipapar secara automatik. Tekan <strong>'Sunting Rekod'</strong> untuk menetapkan sebagai imej kekal.</span>
                  </p>
                )}
              </div>

              {book.urlHalamanHakCipta && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> Halaman Hak Cipta (CIP)
                  </span>
                  <img
                    src={book.urlHalamanHakCipta}
                    alt="Hak Cipta"
                    className="w-full h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>

            {/* Book Bibliographic Data Grid */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => {
                      onEditBook({ ...book, urlGambarKulit: displayCoverUrl || book.urlGambarKulit || '' }, 'noDdc');
                    }}
                    className="text-[10px] font-bold tracking-widest text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 uppercase font-mono transition cursor-pointer flex items-center gap-1 group active:scale-95"
                    title="Klik untuk terus ubah / sunting No. DDC buku ini"
                  >
                    <span>No. DDC: {ddcOnly}</span>
                    <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity text-emerald-600 dark:text-emerald-400" />
                  </button>
                  <span className="text-[10px] font-bold tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 uppercase font-mono">
                    Huruf Pengarang: {authorCode}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {book.judul}
                </h2>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Oleh: {book.pengarang || 'Pengarang Tidak Dinyatakan'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Penerbit</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{book.penerbit || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tempat Terbit</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{book.tempatTerbit || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tahun Terbit</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{book.tahunTerbit || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">ISBN</span>
                  {onEditBook ? (
                    <button
                      type="button"
                      onClick={() => {
                        onEditBook({ ...book, urlGambarKulit: displayCoverUrl || book.urlGambarKulit || '' }, 'isbn');
                      }}
                      className="font-mono font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 inline-flex items-center gap-1.5 group cursor-pointer text-left"
                      title="Klik untuk terus ubah / sunting ISBN buku ini"
                    >
                      <span>{book.isbn || '-'}</span>
                      <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity text-indigo-600 dark:text-indigo-400 shrink-0" />
                    </button>
                  ) : (
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{book.isbn || '-'}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tarikh Ditambah</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{book.tarikhDitambah}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-0.5">Link Buku</span>
                  {book.urlBuku ? (
                    <a
                      href={book.urlBuku}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 font-medium truncate max-w-full"
                    >
                      <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{book.urlBuku}</span>
                    </a>
                  ) : (
                    <span className="text-slate-500 font-medium italic">-</span>
                  )}
                </div>
              </div>

              {/* Catatan */}
              {book.catatan && (
                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                  <span className="font-semibold text-amber-900 dark:text-amber-200 block mb-0.5">Catatan Katalog:</span>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed">{book.catatan}</p>
                </div>
              )}

              {/* Confidence Scores breakdown */}
              {book.confidenceScores && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Tahap Keyakinan OCR AI Bagi Medan:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(book.confidenceScores).map(([k, score]) => {
                      const numScore = Number(score || 0);
                      return (
                        <span
                          key={k}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            numScore >= 80
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : numScore >= 60
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {k}: {numScore}%
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audit Trail Section */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Log Audit & Sejarah Perubahan Buku (Audit Trail)
              </h3>
            </div>

            {book.auditTrail && book.auditTrail.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Masa</th>
                      <th className="py-2.5 px-3">Medan</th>
                      <th className="py-2.5 px-3">Nilai Asal</th>
                      <th className="py-2.5 px-3">Nilai Baharu</th>
                      <th className="py-2.5 px-3">Sumber</th>
                      <th className="py-2.5 px-3">Pengguna</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {book.auditTrail.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{log.timestamp}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{log.field}</td>
                        <td className="py-2 px-3 text-rose-600 dark:text-rose-400 font-mono text-[11px]">{log.oldValue || 'Kosong'}</td>
                        <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">{log.newValue}</td>
                        <td className="py-2 px-3 text-slate-500">{log.source}</td>
                        <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">{log.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Tiada log audit direkodkan lagi.</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={() => onTriggerEnrichment(book)}
            className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cari Metadata AI (Langkah 4)</span>
          </button>

          <div className="flex items-center gap-2">
            {onToggleSpineExportTag && (
              <button
                type="button"
                onClick={() => {
                  if (isUntaggableStatus) {
                    alert('Buku berstatus Draf / Perlu Semakan tidak boleh ditanda untuk cetakan kecuali pilihan "Benarkan Tanda Buku Draf" diaktifkan.');
                    return;
                  }
                  onToggleSpineExportTag(book.id);
                }}
                disabled={isUntaggableStatus}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isUntaggableStatus
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                    : isTagged
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 hover:border-rose-300'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={
                  isUntaggableStatus
                    ? 'Buku berstatus Draf / Perlu Semakan'
                    : isTagged
                    ? 'Ditanda untuk Cetak Tulang Buku (Klik untuk Nyahaktifkan)'
                    : 'Tanda buku ini untuk Cetakan Label Tulang'
                }
              >
                <Bookmark className={`w-3.5 h-3.5 ${isTagged ? 'fill-current' : ''}`} />
                <span>{isTagged ? 'Ditanda (Nyahaktif)' : 'Tanda Cetak'}</span>
              </button>
            )}

            <button
              onClick={() => onPrintLabel(book)}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-100"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Label Tulang</span>
            </button>
            <button
              onClick={handleEditBookClick}
              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:opacity-90 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Sunting Rekod</span>
            </button>
          </div>
        </div>
      </div>
    </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="Padam Status Tulang Dicetak"
        message={`Adakah anda pasti untuk memadam status 'Tulang Dicetak' bagi buku "${book.judul}"?`}
        confirmLabel="Padam Status"
        variant="warning"
        onConfirm={() => {
          if (onToggleBookSpinePrinted) {
            onToggleBookSpinePrinted(book.id, false);
          }
          setShowConfirm(false);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
};
