import React from 'react';
import {
  BookOpen,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Sparkles,
  ArrowRight,
  BookmarkCheck,
  TrendingUp,
  Layers,
  Calendar,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { BookRecord } from '../types';

interface DashboardProps {
  books: BookRecord[];
  setActiveTab: (tab: string) => void;
  onSelectBook: (book: BookRecord) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ books, setActiveTab, onSelectBook }) => {
  const totalBooks = books.length;
  const draftBooks = books.filter((b) => b.status === 'Draf');
  const reviewBooks = books.filter((b) => b.status === 'Perlu Semakan');
  const completeBooks = books.filter((b) => b.status === 'Lengkap');

  // Compute new books this month and this week
  const newThisMonth = books.filter((b) => b.tarikhDitambah.startsWith('2026-07')).length;
  
  const nowTime = new Date().getTime();
  const sevenDaysAgoTime = nowTime - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = books.filter((b) => {
    const time = new Date(b.tarikhDitambah).getTime();
    return !isNaN(time) && time >= sevenDaysAgoTime;
  }).length;

  // Complete vs Draft percentages
  const totalCount = books.length || 1;
  const completeCountVal = completeBooks.length;
  const draftOrReviewCount = draftBooks.length + reviewBooks.length;
  const completePercentage = Math.round((completeCountVal / totalCount) * 100);
  const draftPercentage = Math.round((draftOrReviewCount / totalCount) * 100);

  // DDC Category Distribution
  const ddcCategories: Record<string, number> = {
    '000 Komputer': 0,
    '100 Falsafah': 0,
    '200 Agama': 0,
    '300 Sains Sosial': 0,
    '400 Bahasa': 0,
    '500 Sains': 0,
    '600 Teknologi': 0,
    '700 Kesenian': 0,
    '800 Sastera': 0,
    '900 Sejarah': 0,
  };

  books.forEach((b) => {
    const ddc = b.noDdc || '';
    const num = parseInt(ddc.split(' ')[0]) || 0;
    if (num < 100) ddcCategories['000 Komputer']++;
    else if (num < 200) ddcCategories['100 Falsafah']++;
    else if (num < 300) ddcCategories['200 Agama']++;
    else if (num < 400) ddcCategories['300 Sains Sosial']++;
    else if (num < 500) ddcCategories['400 Bahasa']++;
    else if (num < 600) ddcCategories['500 Sains']++;
    else if (num < 700) ddcCategories['600 Teknologi']++;
    else if (num < 800) ddcCategories['700 Kesenian']++;
    else if (num < 900) ddcCategories['800 Sastera']++;
    else ddcCategories['900 Sejarah']++;
  });

  const ddcChartData = Object.entries(ddcCategories).map(([key, value]) => ({
    name: key.split(' ')[1] || key,
    fullName: key,
    Jumlah: value,
  }));

  // Top active categories with non-zero counts
  const activeCategories = Object.entries(ddcCategories)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  // Year Trend Chart Data
  const yearCounts: Record<string, number> = {};
  books.forEach((b) => {
    const year = b.tahunTerbit || 'Lain-lain';
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  });

  const yearChartData = Object.entries(yearCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, count]) => ({
      tahun: year,
      Buku: count,
    }));



  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-md border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold tracking-wide uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Dashboard Katalog Utama
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Sistem Mini Perpustakaan
          </h2>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('tambah')}
            className="px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs flex items-center gap-2 shadow-xs transition-transform hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Buku (Imbas AI)</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Statistik Component */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Ringkasan Statistik Koleksi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Analisis pantas kategori, status rekod, dan aktiviti penambahan baharu
              </p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Minggu Ini: <strong className="text-emerald-600 dark:text-emerald-400">{newThisWeek} Buku</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
          {/* 1. Buku Mengikut Kategori */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Taburan Mengikut Kategori Utama</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {activeCategories.slice(0, 4).map(([cat, count]) => {
                const percentage = Math.round((count / totalCount) * 100);
                return (
                  <div key={cat} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2">{cat}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{count} buku</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
              {activeCategories.length === 0 && (
                <div className="text-xs text-slate-400 italic py-2">Tiada rekod kategori tersedia.</div>
              )}
            </div>
          </div>

          {/* 2. Peratusan Rekod Lengkap vs Draf */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Status Rekod (Lengkap vs Draf)</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Lengkap: {completePercentage}%
                </span>
                <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Draf/Semakan: {draftPercentage}%
                </span>
              </div>
              {/* Dual Progress Bar */}
              <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full transition-all duration-500"
                  style={{ width: `${completePercentage}%` }}
                  title={`Lengkap: ${completeCountVal} buku (${completePercentage}%)`}
                ></div>
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{ width: `${draftPercentage}%` }}
                  title={`Draf & Semakan: ${draftOrReviewCount} buku (${draftPercentage}%)`}
                ></div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
                <span>{completeCountVal} Rekod Sah</span>
                <span>{draftOrReviewCount} Rekod Belum Selesai</span>
              </div>
            </div>
          </div>

          {/* 3. Penambahan Buku Minggu Ini */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Aktiviti Penambahan Mingguan</span>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex flex-col justify-between h-[120px]">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                  7 Hari Terakhir
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  +{newThisWeek} <span className="text-xs font-medium text-slate-500">Buku Baharu</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Peningkatan konsisten dalam kemasukan data koleksi perpustakaan minggu ini.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Books */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Jumlah Koleksi Buku</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tracking-tight">{totalBooks}</h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              +{newThisMonth} buku baru bulan ini
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Draft Records */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Rekod Draf (Belum Disahkan)</p>
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 tracking-tight">{draftBooks.length}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Menunggu carian metadata AI
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800/60">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Needs Review */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Rekod Perlu Semakan</p>
            <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 tracking-tight">{reviewBooks.length}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Keyakinan OCR &lt; 70% atau medan kosong
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-800/60">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Complete Catalog Records */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Rekod Lengkap Disahkan</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">{completeBooks.length}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Siap untuk carian & cetak label
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Action Queue: Drafts & Review Books Section */}
      {(draftBooks.length > 0 || reviewBooks.length > 0) && (
        <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Syarat Wajib Sistem: Rekod Draf Memerlukan Pengesahan
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('katalog')}
              className="text-xs text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Lihat Semua Katalog</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
            Maklumat hasil OCR telah disimpan sebagai Draf. Anda boleh melancarkan Carian Metadata AI dan mengesahkan perbandingan medan sebelum mengemaskini katalog.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...draftBooks, ...reviewBooks].slice(0, 3).map((book) => (
              <div
                key={book.id}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        book.status === 'Draf'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                      }`}
                    >
                      {book.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{book.isbn || 'Tiada ISBN'}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {book.judul}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {book.pengarang || 'Pengarang tidak dinyatakan'}
                  </p>
                </div>
                <button
                  onClick={() => onSelectBook(book)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 text-xs font-medium shrink-0 shadow-2xs"
                >
                  Semak & Sahkan
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DDC Distribution Bar Chart */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Bilangan Mengikut Pengelasan DDC (Dewey Decimal)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Taburan koleksi mengikut bidang kelas utama DDC
            </p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ddcChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-600 dark:text-slate-400" interval={0} angle={-25} textAnchor="end" />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-600 dark:text-slate-400" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="Jumlah" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Year Trend Line Chart */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Carta Buku Mengikut Tahun Terbit
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Profil sejarah penerbitan bahan dalam perpustakaan
            </p>
          </div>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="tahun" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              <Line type="monotone" dataKey="Buku" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
