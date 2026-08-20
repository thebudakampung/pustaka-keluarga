import React from 'react';
import { Download, FileSpreadsheet, FileCode, FileText } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { BookRecord } from '../types';

interface ExportDataProps {
  books: BookRecord[];
}

export const ExportData: React.FC<ExportDataProps> = ({
  books,
}) => {
  const [statusMessage, setStatusMessage] = React.useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const showStatus = (text: string, type: 'success' | 'warning' | 'error') => {
    setStatusMessage({ text, type });
    // Auto-clear after 6 seconds
    setTimeout(() => {
      setStatusMessage(prev => prev?.text === text ? null : prev);
    }, 6000);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (books.length === 0) {
      showStatus('Katalog buku anda kosong. Sila tambah buku sebelum membuat eksport.', 'error');
      return;
    }

    const exportData = books.map((b, i) => ({
      'Bil': i + 1,
      'Judul Buku': b.judul,
      'Pengarang': b.pengarang,
      'Penerbit': b.penerbit,
      'Tempat Terbit': b.tempatTerbit,
      'Tahun Terbit': b.tahunTerbit,
      'ISBN': b.isbn,
      'No DDC': b.noDdc,
      'Status': b.status,
      'Nombor Perolehan': b.nomborPerolehan,
      'Tarikh Ditambah': b.tarikhDitambah,
    }));

    try {
      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Katalog_Perpustakaan_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showStatus('✓ Berjaya memuat turun fail CSV keseluruhan katalog.', 'success');
    } catch (err) {
      showStatus('Gagal memproses fail CSV.', 'error');
    }
  };

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    if (books.length === 0) {
      showStatus('Katalog buku anda kosong. Sila tambah buku sebelum membuat eksport.', 'error');
      return;
    }

    const exportData = books.map((b, i) => ({
      'Bil': i + 1,
      'Judul Buku': b.judul,
      'Pengarang': b.pengarang,
      'Penerbit': b.penerbit,
      'Tempat Terbit': b.tempatTerbit,
      'Tahun Terbit': b.tahunTerbit,
      'ISBN': b.isbn,
      'No DDC': b.noDdc,
      'Status': b.status,
      'Nombor Perolehan': b.nomborPerolehan,
      'Tarikh Ditambah': b.tarikhDitambah,
    }));

    try {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Katalog Buku');
      XLSX.writeFile(wb, `Katalog_Perpustakaan_${new Date().toISOString().split('T')[0]}.xlsx`);
      showStatus('✓ Berjaya memuat turun fail Excel (.xlsx) katalog.', 'success');
    } catch (err) {
      showStatus('Gagal menjana fail Excel.', 'error');
    }
  };

  // Export JSON
  const handleExportJSON = () => {
    if (books.length === 0) {
      showStatus('Katalog buku anda kosong. Sila tambah buku sebelum membuat eksport.', 'error');
      return;
    }

    try {
      const jsonString = JSON.stringify(books, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Katalog_Perpustakaan_${new Date().toISOString().split('T')[0]}.json`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showStatus('✓ Berjaya memuat turun fail JSON database.', 'success');
    } catch (err) {
      showStatus('Gagal menjana fail JSON.', 'error');
    }
  };

  // Print Summary Catalog / PDF
  const handlePrintPDF = () => {
    if (books.length === 0) {
      showStatus('Katalog buku anda kosong. Sila tambah buku sebelum mencetak laporan.', 'error');
      return;
    }

    const printWin = window.open('', '_blank', 'width=1000,height=800');
    if (!printWin) {
      try {
        window.print();
      } catch (e) {
        showStatus('Fungsi cetakan disekat oleh pelayar. Sila benarkan tetingkap timbul (pop-up) untuk mencetak.', 'error');
      }
      return;
    }

    const rowsHtml = books.map((b, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; font-weight: bold; font-family: monospace;">${b.nomborPerolehan || '-'}</td>
        <td style="padding: 6px 8px; font-weight: 600; color: #0f172a;">${b.judul}</td>
        <td style="padding: 6px 8px;">${b.pengarang || '-'}</td>
        <td style="padding: 6px 8px; font-family: monospace; font-weight: bold; color: #0284c7;">${b.noDdc || '-'}</td>
        <td style="padding: 6px 8px;">${b.penerbit || '-'}</td>
        <td style="padding: 6px 8px; text-align: center;">${b.tahunTerbit || '-'}</td>
        <td style="padding: 6px 8px; text-align: center;">${b.status}</td>
      </tr>
    `).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Laporan Katalog Perpustakaan - Pustaka Keluarga</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 0; background: white; }
            .no-print { background: #f8fafc; padding: 12px 20px; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; }
            .btn { background: #0284c7; color: white; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer; }
            .btn-close { background: #64748b; margin-left: 8px; }
            @media print { .no-print { display: none !important; } body { padding: 0; } }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #0f172a; color: white; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="no-print">
            <span style="font-weight: bold; font-size: 14px;">📄 Laporan Katalog Indeks Perpustakaan (${books.length} Rekod Buku)</span>
            <div>
              <button class="btn" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
              <button class="btn btn-close" onclick="window.close()">Tutup</button>
            </div>
          </div>
          <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">
              <div>
                <h1 style="margin: 0; font-size: 20px; color: #0f172a;">PUSTAKA KELUARGA VEDSAPURA</h1>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Laporan Rasmi Katalog Perolehan Buku Perpustakaan</p>
              </div>
              <div style="text-align: right; font-size: 11px; color: #64748b;">
                <div>Tarikh Laporan: ${new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                <div>Jumlah Rekod: ${books.length} Buku</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 35px; text-align: center;">Bil</th>
                  <th style="width: 110px;">No Perolehan</th>
                  <th>Judul Buku</th>
                  <th>Pengarang</th>
                  <th style="width: 90px;">No DDC</th>
                  <th>Penerbit</th>
                  <th style="width: 60px; text-align: center;">Tahun</th>
                  <th style="width: 70px; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Download className="w-5 h-5 text-emerald-600" />
          <span>Eksport Data Katalog</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Muat turun pangkalan data perpustakaan dalam pelbagai format profesional (CSV, Excel, PDF, JSON) termasuk eksport khusus untuk proses cetakan tulang buku.
        </p>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all duration-300 ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
            : statusMessage.type === 'warning'
            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
            : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="ml-2 hover:opacity-75 text-sm font-bold">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* CSV Export Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Eksport CSV Keseluruhan</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sesuai untuk analisis ringkas dan dibuka dalam mana-mana perisian spreadsheet.
          </p>
          <button
            onClick={handleExportCSV}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold shadow-2xs hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Muat Turun .CSV</span>
          </button>
        </div>

        {/* Excel Export Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Eksport Excel (.XLSX)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Format Microsoft Excel lengkap dengan pengepala lajur rasmi.
          </p>
          <button
            onClick={handleExportExcel}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-2xs hover:bg-emerald-700 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Muat Turun .XLSX</span>
          </button>
        </div>

        {/* JSON Export Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center font-bold">
            <FileCode className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Eksport JSON Database</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Penyimpanan data lengkap beserta log audit dan nilai keyakinan OCR untuk sandaran (backup).
          </p>
          <button
            onClick={handleExportJSON}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold shadow-2xs hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Muat Turun .JSON</span>
          </button>
        </div>

        {/* PDF Cetakan Summary Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Cetak Laporan PDF</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Jana cetakan Senarai Indeks Katalog Rasmi Perpustakaan.
          </p>
          <button
            onClick={handlePrintPDF}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold shadow-2xs hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
