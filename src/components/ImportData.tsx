import React, { useState } from 'react';
import { FileSpreadsheet, Upload, FolderUp, CheckCircle2, AlertCircle, Sparkles, FileText, Loader2, Trash2, Plus, RotateCcw, BookOpen, Copy } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { BookRecord } from '../types';
import { get3LetterAuthorCode } from '../utils/spineUtils';

interface ImportDataProps {
  onBulkImportBooks: (newBooks: BookRecord[]) => void;
  setActiveTab: (tab: string) => void;
}

export const ImportData: React.FC<ImportDataProps> = ({
  onBulkImportBooks,
  setActiveTab,
}) => {
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkRawText, setBulkRawText] = useState('');
  const [isParsingRaw, setIsParsingRaw] = useState(false);
  const [extractedPreviewBooks, setExtractedPreviewBooks] = useState<any[] | null>(null);

  const SAMPLE_BULK_TEXT = `1. Sejarah Melayu (Sulalatus Salatin) - Tun Seri Lanang - Penerbit Fajar Bakti - 2020 - ISBN 9789831234567 - DDC 959.5 TUN
---
2. Hikayat Hang Tuah
Pengarang: Kassim Ahmad
Penerbit: Dewan Bahasa dan Pustaka
Tempat Terbit: Kuala Lumpur
Tahun: 2021
ISBN: 9789834912345
No. DDC: 899.231 KAS
Link: https://dbp.gov.my/hang-tuah
---
3. Asas Sains Komputer & Pemrograman - Dr. Ahmad Farhan - Penerbit Universiti Malaya - 2023 - ISBN 9789674880012 - DDC 005.1 AHM`;

  const handleLoadSampleText = () => {
    setBulkRawText(SAMPLE_BULK_TEXT);
  };

  const KNOWN_CITIES = [
    // Malaysia
    'Kuala Lumpur', 'Bangi', 'Shah Alam', 'Putrajaya', 'Petaling Jaya',
    'Subang Jaya', 'George Town', 'Pulau Pinang', 'Penang', 'Ipoh',
    'Johor Bahru', 'Melaka', 'Malacca', 'Kota Bharu', 'Alor Setar',
    'Kota Kinabalu', 'Kuching', 'Cyberjaya', 'Serdang', 'Sintok',
    'Tanjong Malim', 'Nilai', 'Kuantan', 'Kuala Terengganu', 'Kangar',
    'Batu Pahat', 'Muar', 'Skudai', 'Perlis', 'Kedah', 'Perak', 'Selangor',
    'Negeri Sembilan', 'Pahang', 'Terengganu', 'Kelantan', 'Sabah', 'Sarawak', 'Johor',
    // Negara Luar & Antarabangsa
    'Amerika Syarikat', 'United States', 'USA', 'U.S.A.', 'US', 'United Kingdom', 'UK', 'U.K.',
    'Great Britain', 'England', 'Indonesia', 'Australia', 'Mesir', 'Egypt', 'Arab Saudi', 'Saudi Arabia',
    'Jepun', 'Japan', 'Jerman', 'Germany', 'Perancis', 'France', 'India', 'China', 'Thailand',
    'Singapura', 'Singapore', 'Brunei', 'Kanada', 'Canada', 'Belanda', 'Netherlands', 'New Zealand',
    'Switzerland', 'Sweden', 'Turki', 'Turkey',
    // Bandar Luar Malaysia
    'Jakarta', 'Bandung', 'Yogyakarta', 'Surabaya', 'Medan', 'London', 'New York', 'Cairo', 'Kaherah',
    'Oxford', 'Cambridge', 'Boston', 'Chicago', 'Princeton', 'Tokyo', 'Beijing', 'Riyadh', 'Makkah',
    'Madinah', 'Sydney', 'Melbourne', 'Toronto', 'Paris', 'Berlin', 'Amsterdam'
  ];

  const extractPlaceAndPublisher = (penerbitInput: string, tempatInput: string) => {
    let penerbit = (penerbitInput || '').replace(/[\.\s:;,]+$/, '').trim();
    let tempatTerbit = (tempatInput || '').replace(/[\.\s:;,]+$/, '').trim();

    // 1. If penerbit contains comma(s), e.g. "Princeton University Press Princeton, Amerika Syarikat." or "Penerbit Erlangga, Jakarta, Indonesia"
    if (penerbit.includes(',')) {
      const parts = penerbit.split(',').map((p) => p.trim()).filter(Boolean);
      const locParts: string[] = [];

      while (parts.length > 1) {
        const lastPart = parts[parts.length - 1].replace(/[\.\s:;,]+$/, '').trim();
        const isKnown = KNOWN_CITIES.find((c) => new RegExp(`^${c}$|\\b${c}\\b`, 'i').test(lastPart));
        const looksLikeLocation = lastPart.length > 0 && lastPart.length < 35 && !/penerbit|publisher|press|books|publishing|edition|inc|ltd|sdn|bhd/i.test(lastPart);

        if (isKnown || looksLikeLocation) {
          locParts.unshift(lastPart);
          parts.pop();
        } else {
          break;
        }
      }

      if (locParts.length > 0) {
        const lastLoc = locParts[locParts.length - 1];
        const isMalaysiaLoc = /kuala lumpur|putrajaya|bangi|shah alam|selangor|perak|johor|kedah|kelantan|terengganu|pahang|sabah|sarawak|penang|melaka|perlis|negeri sembilan/i.test(locParts.join(' '));

        if (isMalaysiaLoc) {
          tempatTerbit = locParts.join(', ');
        } else {
          tempatTerbit = lastLoc;
        }

        penerbit = parts.join(', ');
      }
    }

    // 2. Check format "City : Publisher" or "Publisher : City" if tempatTerbit still empty
    if (!tempatTerbit && penerbit.includes(':')) {
      const parts = penerbit.split(':').map((p) => p.trim()).filter(Boolean);
      const firstIsCity = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(parts[0]));
      const secondIsCity = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(parts[1]));

      if (firstIsCity) {
        tempatTerbit = firstIsCity;
        penerbit = parts[1];
      } else if (secondIsCity) {
        tempatTerbit = secondIsCity;
        penerbit = parts[0];
      }
    }

    // 3. Check format "Publisher (City/Country)" if tempatTerbit still empty
    if (!tempatTerbit && /\(([^)]+)\)/.test(penerbit)) {
      const match = penerbit.match(/\(([^)]+)\)/);
      if (match) {
        const inside = match[1].replace(/[\.\s:;,]+$/, '').trim();
        const foundCity = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(inside)) || (inside.length < 30 ? inside : '');
        if (foundCity) {
          tempatTerbit = foundCity;
          penerbit = penerbit.replace(/\([^)]+\)/, '').trim();
        }
      }
    }

    // 4. Search for known city/country at the end of penerbit string
    if (!tempatTerbit && penerbit) {
      for (const city of KNOWN_CITIES) {
        const reg = new RegExp(`[\\s,:]+${city}[\\.\\s]*$`, 'i');
        if (reg.test(penerbit)) {
          tempatTerbit = city;
          penerbit = penerbit.replace(reg, '').trim();
          break;
        }
      }
    }

    // 5. Clean trailing duplicate location names from penerbit (e.g. "Princeton University Press Princeton" -> "Princeton University Press")
    if (penerbit) {
      for (const city of KNOWN_CITIES) {
        const reg = new RegExp(`[\\s,:]+${city}[\\.\\s]*$`, 'i');
        if (reg.test(penerbit)) {
          penerbit = penerbit.replace(reg, '').trim();
          break;
        }
      }
    }

    // 6. Fallback search anywhere in penerbit if tempatTerbit still empty
    if (!tempatTerbit && penerbit) {
      const foundCity = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(penerbit));
      if (foundCity) {
        tempatTerbit = foundCity;
      }
    }

    penerbit = penerbit.replace(/[\.\s:;,]+$/, '').trim();
    tempatTerbit = tempatTerbit.replace(/[\.\s:;,]+$/, '').trim();

    return { penerbit, tempatTerbit };
  };

  const parseBulkTextHeuristicClient = (rawText: string): any[] => {
    const chunks = rawText
      .split(/(?:\r?\n){2,}|---+|===+|(?=^Buku\s+\d+:?)|(?=^\d+[\.\)]\s+)/im)
      .map((c) => c.trim())
      .filter((c) => c.length > 3);

    const results: any[] = [];
    chunks.forEach((chunk, index) => {
      const lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let judul = '';
      let pengarang = '';
      let penerbit = '';
      let tahunTerbit = '';
      let isbn = '';
      let noDdc = '';
      let tempatTerbit = '';
      let urlBuku = '';

      if (lines.length === 1 && (chunk.includes(' - ') || chunk.includes(' / ') || chunk.includes(';'))) {
        const parts = chunk
          .replace(/^\d+[\.\)]\s*/, '')
          .split(/\s+[-–|/]\s+|\s*;\s*/)
          .map((p) => p.trim())
          .filter(Boolean);

        if (parts.length >= 1) judul = parts[0];
        if (parts.length >= 2) pengarang = parts[1];
        if (parts.length >= 3) penerbit = parts[2];
        if (parts.length >= 4) {
          if (/^\d{4}$/.test(parts[3])) {
            tahunTerbit = parts[3];
          } else if (/978|ISBN/i.test(parts[3])) {
            isbn = parts[3];
          } else if (/\d{3}\.\d+/.test(parts[3])) {
            noDdc = parts[3];
          } else {
            penerbit = `${penerbit} ${parts[3]}`.trim();
          }
        }
      } else {
        lines.forEach((line) => {
          const lower = line.toLowerCase();
          if (lower.startsWith('judul:') || lower.startsWith('tajuk:') || lower.startsWith('title:')) {
            judul = line.replace(/^(judul|tajuk|title):\s*/i, '').trim();
          } else if (lower.startsWith('pengarang:') || lower.startsWith('penulis:') || lower.startsWith('author:')) {
            pengarang = line.replace(/^(pengarang|penulis|author):\s*/i, '').trim();
          } else if (lower.startsWith('penerbit:') || lower.startsWith('publisher:')) {
            penerbit = line.replace(/^(penerbit|publisher):\s*/i, '').trim();
          } else if (lower.startsWith('isbn:')) {
            isbn = line.replace(/^isbn:\s*/i, '').trim();
          } else if (lower.includes('ddc') || lower.includes('pengelasan')) {
            noDdc = line.replace(/^(ddc[\+\s\w]*|no\.?\s*ddc[\+\s\w]*|pengelasan[^\n]*?):\s*/i, '').trim();
          } else if (lower.startsWith('tahun:') || lower.startsWith('year:')) {
            tahunTerbit = line.replace(/^(tahun|year):\s*/i, '').trim();
          } else if (lower.startsWith('tempat:') || lower.startsWith('tempat terbit:') || lower.startsWith('lokasi:') || lower.startsWith('bandar:') || lower.startsWith('place:') || lower.startsWith('city:') || lower.startsWith('place of publication:')) {
            tempatTerbit = line.replace(/^(tempat|tempat terbit|lokasi|bandar|place|city|place of publication):\s*/i, '').trim();
          } else if (lower.startsWith('link buku:') || lower.startsWith('link:') || lower.startsWith('url:') || lower.startsWith('http://') || lower.startsWith('https://')) {
            urlBuku = line.replace(/^(link buku|link|url):\s*/i, '').trim();
          } else if (!judul) {
            judul = line.replace(/^\d+[\.\)]\s*/, '').replace(/^Buku\s+\d+:?\s*/i, '').trim();
          } else if (!pengarang && !line.includes(':')) {
            pengarang = line.trim();
          }
        });
      }

      if (!judul && lines[0]) {
        judul = lines[0].replace(/^\d+[\.\)]\s*/, '').trim();
      }

      if (judul) {
        const isbnMatch = chunk.match(/978[-0-9X]{10,17}/i) || chunk.match(/ISBN[-:\s]*([0-9X-]+)/i);
        if (isbnMatch && !isbn) {
          isbn = isbnMatch[1] || isbnMatch[0];
        }

        const yearMatch = chunk.match(/\b(19|20)\d{2}\b/);
        if (yearMatch && !tahunTerbit) {
          tahunTerbit = yearMatch[0];
        }

        const ddcMatch = chunk.match(/\b(\d{3}\.\d+\s+[A-Z]{3})\b/i);
        if (ddcMatch && !noDdc) {
          noDdc = ddcMatch[1];
        }

        const urlMatch = chunk.match(/https?:\/\/[^\s]+/i);
        if (urlMatch && !urlBuku) {
          urlBuku = urlMatch[0];
        }

        // Clean place & publisher
        const extracted = extractPlaceAndPublisher(penerbit, tempatTerbit);
        penerbit = extracted.penerbit;
        tempatTerbit = extracted.tempatTerbit;

        if (!tempatTerbit) {
          const foundCity = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(chunk));
          if (foundCity) {
            tempatTerbit = foundCity;
          }
        }

        const author3 = get3LetterAuthorCode(pengarang);

        results.push({
          judul: judul.slice(0, 150),
          pengarang: pengarang || 'Pengarang Terpilih',
          tempatTerbit: tempatTerbit || 'Kuala Lumpur',
          penerbit: penerbit || 'Penerbit Pustaka',
          tahunTerbit: tahunTerbit || '2024',
          isbn: isbn || '',
          noDdc: noDdc || `000.0 ${author3}`,
          urlBuku: urlBuku || '',
          catatan: `Import Teks Raw Pukal #${index + 1}`,
        });
      }
    });

    return results.length > 0
      ? results
      : [
          {
            judul: rawText.split('\n')[0].replace(/^\d+[\.\)]\s*/, '').slice(0, 80) || 'Buku Pukal 1',
            pengarang: 'Pengarang Terpilih',
            tempatTerbit: 'Kuala Lumpur',
            penerbit: 'Penerbit Pustaka',
            tahunTerbit: '2024',
            isbn: '',
            noDdc: '000.0 UNK',
            catatan: 'Import Teks Raw Pukal',
          },
        ];
  };

  const estimatedBookCount = bulkRawText.trim()
    ? parseBulkTextHeuristicClient(bulkRawText).length
    : 0;

  // File Upload CSV/Excel
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportStatus('Membaca fail spreadsheet...');

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processRawRows(results.data);
        },
        error: (err) => {
          setIsProcessing(false);
          setImportStatus(`Ralat membaca CSV: ${err.message}`);
        },
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          const data = XLSX.utils.sheet_to_json(ws);
          processRawRows(data);
        } catch (err: any) {
          setIsProcessing(false);
          setImportStatus(`Ralat membaca fail Excel: ${err.message}`);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setIsProcessing(false);
      setImportStatus('Sila muat naik fail berformat .csv atau .xlsx');
    }
  };

  const processRawRows = (rows: any[]) => {
    const parsedBooks: BookRecord[] = [];

    rows.forEach((row, index) => {
      const judul = row['Judul Buku'] || row['judul'] || row['Title'] || row['title'] || '';
      if (!judul) return;

      const pengarang = row['Pengarang'] || row['pengarang'] || row['Author'] || '';
      const rawPenerbit = row['Penerbit'] || row['penerbit'] || row['Publisher'] || '';
      const rawTempat = row['Tempat Terbit'] || row['tempatTerbit'] || row['Tempat'] || row['Place'] || row['Place of Publication'] || row['Lokasi'] || row['Bandar'] || row['City'] || '';
      
      const { penerbit, tempatTerbit } = extractPlaceAndPublisher(rawPenerbit, rawTempat);

      const tahunTerbit = String(row['Tahun Terbit'] || row['tahunTerbit'] || row['Year'] || '');
      const isbn = String(row['ISBN'] || row['isbn'] || '');
      const noDdc = String(row['No DDC'] || row['noDdc'] || row['DDC'] || '');

      parsedBooks.push({
        id: `import-${Date.now()}-${index}`,
        noBil: Date.now() + index,
        judul,
        pengarang,
        tempatTerbit: tempatTerbit || 'Kuala Lumpur',
        penerbit: penerbit || 'Penerbit Pustaka',
        tahunTerbit,
        isbn,
        noDdc,
        tarikhDitambah: new Date().toISOString(),
        status: 'Draf', // Mandatory draft requirement
        catatan: 'Diimport daripada fail spreadsheet pukal.',
        nomborPerolehan: `PER-2026-${Math.floor(100 + Math.random() * 900)}`,
        confidenceScores: {
          judul: 100,
          pengarang: 90,
          isbn: isbn ? 100 : 0,
          noDdc: noDdc ? 90 : 0,
          tempatTerbit: tempatTerbit ? 100 : 60,
        },
        auditTrail: [
          {
            id: `aud-imp-${Date.now()}-${index}`,
            bookId: `import-${Date.now()}-${index}`,
            timestamp: new Date().toLocaleString('ms-MY'),
            field: 'Status',
            oldValue: '-',
            newValue: 'Draf',
            source: 'Import Pukal',
            user: 'Pustakawan Import',
          },
        ],
      });
    });

    onBulkImportBooks(parsedBooks);
    setIsProcessing(false);
    setImportedCount(parsedBooks.length);
    setImportStatus(`Berjaya mengimport ${parsedBooks.length} rekod buku sebagai Draf!`);
  };

  // Bulk Image Upload (Folder / Multiple Covers)
  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setImportStatus(`Mengekstrak ${files.length} gambar muka depan secara pukal...`);

    const createdDrafts: BookRecord[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filenameClean = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      const accessionNo = `PER-2026-${Math.floor(100 + Math.random() * 900)}`;

      createdDrafts.push({
        id: `bulk-img-${Date.now()}-${i}`,
        noBil: Date.now() + i,
        judul: filenameClean || `Buku Imbasan Pukal ${i + 1}`,
        pengarang: 'Perlu Semakan',
        tempatTerbit: '',
        penerbit: '',
        tahunTerbit: '',
        isbn: '',
        noDdc: '',
        tarikhDitambah: new Date().toISOString(),
        status: 'Draf', // Mandatory draft requirement
        catatan: `Muat naik gambar pukal: ${file.name}`,
        nomborPerolehan: accessionNo,
        urlGambarKulit: URL.createObjectURL(file),
        confidenceScores: {
          judul: 70,
          pengarang: 0,
          isbn: 0,
          noDdc: 0,
        },
        auditTrail: [
          {
            id: `aud-bulk-${Date.now()}-${i}`,
            bookId: `bulk-img-${Date.now()}-${i}`,
            timestamp: new Date().toLocaleString('ms-MY'),
            field: 'Status',
            oldValue: '-',
            newValue: 'Draf',
            source: 'Import Pukal',
            user: 'Pustakawan Bulk Upload',
          },
        ],
      });
    }

    onBulkImportBooks(createdDrafts);
    setIsProcessing(false);
    setImportedCount(createdDrafts.length);
    setImportStatus(`Berjaya mencipta ${createdDrafts.length} rekod draf daripada gambar pukal!`);
  };

  const handleBulkRawTextProcess = async () => {
    if (!bulkRawText.trim()) return;
    setIsParsingRaw(true);
    setImportStatus('AI sedang mengekstrak teks raw pukal berbilang buku...');

    let booksData: any[] = [];
    try {
      const res = await fetch('/api/bulk-raw-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: bulkRawText }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        booksData = parseBulkTextHeuristicClient(bulkRawText);
      } else {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.books)) {
          booksData = data.books;
        } else {
          booksData = parseBulkTextHeuristicClient(bulkRawText);
        }
      }
    } catch (err: any) {
      console.warn('Fallback to client heuristic due to network/JSON error:', err);
      booksData = parseBulkTextHeuristicClient(bulkRawText);
    }

    const draftsPreview = booksData.map((item: any, i: number) => {
      const accessionNo = `PER-2026-${Math.floor(100 + Math.random() * 900)}`;
      return {
        id: `bulk-raw-${Date.now()}-${i}`,
        noBil: Date.now() + i,
        judul: item.judul || `Buku Raw ${i + 1}`,
        pengarang: item.pengarang || 'Pengarang Terpilih',
        tempatTerbit: item.tempatTerbit || '',
        penerbit: item.penerbit || '',
        tahunTerbit: item.tahunTerbit || '',
        isbn: item.isbn || '',
        noDdc: item.noDdc || '',
        urlBuku: item.urlBuku || '',
        tarikhDitambah: new Date().toISOString(),
        status: 'Draf',
        catatan: item.catatan || 'Diimport daripada Tampal Teks Raw Pukal AI',
        nomborPerolehan: accessionNo,
        confidenceScores: {
          judul: 90,
          pengarang: 85,
          isbn: item.isbn ? 95 : 0,
          noDdc: item.noDdc ? 80 : 0,
        },
        auditTrail: [
          {
            id: `aud-raw-${Date.now()}-${i}`,
            bookId: `bulk-raw-${Date.now()}-${i}`,
            timestamp: new Date().toLocaleString('ms-MY'),
            field: 'Status',
            oldValue: '-',
            newValue: 'Draf',
            source: 'Import Teks Raw Pukal',
            user: 'Pustakawan Raw Text',
          },
        ],
      };
    });

    setExtractedPreviewBooks(draftsPreview);
    setImportStatus(`Berjaya mengekstrak ${draftsPreview.length} buku. Sila buat semakan sebelum simpan.`);
    setIsParsingRaw(false);
  };

  const handleConfirmSaveExtractedBooks = () => {
    if (!extractedPreviewBooks || extractedPreviewBooks.length === 0) return;
    onBulkImportBooks(extractedPreviewBooks);
    setImportedCount(extractedPreviewBooks.length);
    setImportStatus(`Berjaya menyimpan ${extractedPreviewBooks.length} rekod buku daripada hasil ekstraksi AI!`);
    setExtractedPreviewBooks(null);
    setBulkRawText('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <span>Import Data Pukal (Bulk Import)</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Muat naik koleksi buku sedia ada melalui CSV, Excel, Gambar Pukal, atau Tampal Teks Raw Berbilang Buku. Semua rekod diimport sebagai Draf.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CSV & Excel Import Panel */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              1. Import Fail CSV / Excel (.xlsx)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Pilih fail spreadsheet mengandungi lajur: Judul Buku, Pengarang, Penerbit, Tahun Terbit, ISBN, No DDC.
          </p>

          <label className="block p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
              Pilih Fail CSV atau Excel
            </span>
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Bulk Cover Images Upload Panel */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <FolderUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              2. Import Gambar Pukal (Bulk Covers)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Muat naik kelompok gambar muka depan buku sekaligus. Sistem akan mencipta rekod draf bagi setiap gambar.
          </p>

          <label className="block p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <FolderUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
              Pilih Berbilang Gambar Muka Depan
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleBulkImageUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 3. Bulk Raw Text Paste Panel */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              3. Tampal Teks Raw Pukal (Copy & Paste Sekali Banyak Utk Berbilang Buku)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {estimatedBookCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200/80 dark:border-emerald-800">
                🎯 ~{estimatedBookCount} buku dikesan
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Auto-Extract</span>
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Tampal teks raw yang mengandungi maklumat berbilang buku sekaligus (contoh: dipisahkan oleh perenggan, nombor 1, 2, 3, atau garisan ---). AI akan membaca dan mengasingkan setiap buku ke dalam rekod draf berasingan secara automatik!
        </p>

        {/* Quick actions for raw text pasting */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSampleText}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-bold transition-colors flex items-center gap-1.5 cursor-pointer text-[11px]"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Muat Contoh Teks Pukal</span>
            </button>
            {bulkRawText && (
              <button
                type="button"
                onClick={() => setBulkRawText('')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition-colors flex items-center gap-1.5 cursor-pointer text-[11px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Padam Teks</span>
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {bulkRawText.length} aksara
          </span>
        </div>

        <textarea
          value={bulkRawText}
          onChange={(e) => setBulkRawText(e.target.value)}
          rows={6}
          placeholder={`Tampal senarai/teks raw berbilang buku di sini... Contoh:\n\n1. Sejarah Melayu - Tun Seri Lanang - Penerbit Fajar 2020 - ISBN 9789831234567\n---\n2. Hikayat Hang Tuah\nPengarang: Kassim Ahmad\nPenerbit: Dewan Bahasa dan Pustaka\nTahun: 2021\nISBN: 9789830000000\n\n3. Asas Sains Komputer - Dr. Ahmad - 2023`}
          className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleBulkRawTextProcess}
            disabled={!bulkRawText.trim() || isParsingRaw}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isParsingRaw ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses & Mengekstrak Pukal AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Ekstrak & Tambah Semua Buku Pukal</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Output */}
      {importStatus && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{importStatus}</span>
          </div>
          <button
            onClick={() => setActiveTab('katalog')}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs shadow-2xs hover:opacity-90 cursor-pointer"
          >
            Lihat Katalog
          </button>
        </div>
      )}

      {/* Modal Semakan Hasil Ekstraksi Bibliografi Pukal AI */}
      {extractedPreviewBooks && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <span>Hasil Ekstraksi Bibliografi Pukal AI ({extractedPreviewBooks.length} Buku)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sila semak & sunting maklumat sebelum disimpan ke dalam katalog sebagai Draf.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const i = extractedPreviewBooks.length;
                    const accessionNo = `PER-2026-${Math.floor(100 + Math.random() * 900)}`;
                    const newEntry = {
                      id: `bulk-raw-${Date.now()}-${i}`,
                      noBil: Date.now() + i,
                      judul: 'Judul Buku Baru',
                      pengarang: 'Pengarang Terpilih',
                      tempatTerbit: 'Kuala Lumpur',
                      penerbit: 'Penerbit Pustaka',
                      tahunTerbit: '2024',
                      isbn: '',
                      noDdc: '000.0 UNK',
                      urlBuku: '',
                      tarikhDitambah: new Date().toISOString().split('T')[0],
                      status: 'Draf',
                      catatan: 'Ditambah Secara Manual dalam Semakan Pukal',
                      nomborPerolehan: accessionNo,
                      confidenceScores: { judul: 100, pengarang: 100, isbn: 0, noDdc: 100 },
                      auditTrail: [],
                    };
                    setExtractedPreviewBooks([...extractedPreviewBooks, newEntry]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Buku Draf</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExtractedPreviewBooks(null)}
                  className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold hover:bg-slate-300 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {extractedPreviewBooks.map((book, idx) => (
                <div key={book.id || idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3 relative group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-[11px] font-bold">
                        Buku {idx + 1}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">No. Perolehan: {book.nomborPerolehan}</span>
                    </div>
                    {extractedPreviewBooks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = extractedPreviewBooks.filter((_, i) => i !== idx);
                          setExtractedPreviewBooks(updated);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        title="Padam buku ini daripada senarai semakan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Padam</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Judul Buku</label>
                      <input
                        type="text"
                        value={book.judul}
                        onChange={(e) => {
                          const updated = [...extractedPreviewBooks];
                          updated[idx].judul = e.target.value;
                          setExtractedPreviewBooks(updated);
                        }}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Pengarang</label>
                      <input
                        type="text"
                        value={book.pengarang}
                        onChange={(e) => {
                          const updated = [...extractedPreviewBooks];
                          updated[idx].pengarang = e.target.value;
                          setExtractedPreviewBooks(updated);
                        }}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Penerbit</label>
                      <input
                        type="text"
                        value={book.penerbit}
                        onChange={(e) => {
                          const updated = [...extractedPreviewBooks];
                          updated[idx].penerbit = e.target.value;
                          setExtractedPreviewBooks(updated);
                        }}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Tempat Terbit</label>
                      <input
                        type="text"
                        value={book.tempatTerbit}
                        onChange={(e) => {
                          const updated = [...extractedPreviewBooks];
                          updated[idx].tempatTerbit = e.target.value;
                          setExtractedPreviewBooks(updated);
                        }}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Tahun Terbit</label>
                      <input
                        type="text"
                        value={book.tahunTerbit}
                        onChange={(e) => {
                          const updated = [...extractedPreviewBooks];
                          updated[idx].tahunTerbit = e.target.value;
                          setExtractedPreviewBooks(updated);
                        }}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">ISBN</label>
                      <input
                        type="text"
                        value={book.isbn}
                        onChange={(e) => {
                          const updated = [...extractedPreviewBooks];
                          updated[idx].isbn = e.target.value;
                          setExtractedPreviewBooks(updated);
                        }}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">No. DDC + 3 Huruf Pengarang</label>
                      <input
                        type="text"
                        value={book.noDdc}
                        onChange={(e) => {
                          const updated = [...extractedPreviewBooks];
                          updated[idx].noDdc = e.target.value;
                          setExtractedPreviewBooks(updated);
                        }}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Link Buku (URL)</label>
                      <input
                        type="url"
                        value={book.urlBuku || ''}
                        onChange={(e) => {
                          const updated = [...extractedPreviewBooks];
                          updated[idx].urlBuku = e.target.value;
                          setExtractedPreviewBooks(updated);
                        }}
                        placeholder="https://www.abebooks.com/..."
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setExtractedPreviewBooks(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveExtractedBooks}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sah & Simpan Semua ({extractedPreviewBooks.length}) Ke Katalog Draf</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
