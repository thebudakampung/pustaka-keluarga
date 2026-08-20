import React from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  Sun,
  Moon,
  AlertCircle,
  FileText,
  LayoutDashboard,
  BookMarked,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Printer,
  History,
  Settings as SettingsIcon,
  CloudCheck,
} from 'lucide-react';
import { BookRecord, LibrarySettings } from '../types';

interface NavbarProps {
  books: BookRecord[];
  settings: LibrarySettings;
  onUpdateSettings: (newSettings: LibrarySettings) => void;
  onOpenSearch: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isFirebaseConnected?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  books,
  settings,
  onUpdateSettings,
  onOpenSearch,
  activeTab,
  setActiveTab,
  isFirebaseConnected = true,
}) => {
  const drafCount = books.filter((b) => b.status === 'Draf').length;
  const reviewCount = books.filter((b) => b.status === 'Perlu Semakan').length;

  const toggleTheme = () => {
    const nextTheme = settings.temaWarna === 'dark' ? 'light' : 'dark';
    onUpdateSettings({ ...settings, temaWarna: nextTheme });
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'katalog', label: 'Katalog Buku', icon: BookMarked },
    { id: 'tambah', label: 'Tambah Buku (AI OCR)', icon: PlusCircle, highlight: true },
    { id: 'import', label: 'Import Data', icon: FileSpreadsheet },
    { id: 'export', label: 'Eksport Data', icon: Download },
    { id: 'cetak', label: 'Cetak Label', icon: Printer },
    { id: 'audit', label: 'Log Audit', icon: History },
    { id: 'tetapan', label: 'Tetapan', icon: SettingsIcon },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Bar Utama Atas */}
        <div className="h-16 flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60">
          {/* Brand / Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-sm font-bold text-lg transition-transform hover:scale-105">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-slate-900 dark:text-slate-100 text-base tracking-tight">
                  {settings.namaPerpustakaan || 'Sistem Mini Perpustakaan AI'}
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 rounded-full flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> AI Vision
                </span>
                {isFirebaseConnected && (
                  <span className="px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-200 dark:border-sky-800/80 rounded-full flex items-center gap-1" title="Data tersimpan secara langsung dalam Firebase Firestore (Akses Web Awam)">
                    <CloudCheck className="w-3 h-3 text-sky-600 dark:text-sky-400" /> Firebase Sync
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Katalog & Pengesahan Bibliografi Buku
              </p>
            </div>
          </div>

          {/* Global Quick Search & Status Indicators */}
          <div className="flex items-center gap-2.5">
            {/* Search Trigger */}
            <button
              onClick={onOpenSearch}
              className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-xs font-medium transition-all border border-slate-200/60 dark:border-slate-700/60 shadow-2xs"
              title="Carian Pantas"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Cari Judul, ISBN, DDC...</span>
            </button>

            {/* Draf Counter Badge */}
            {drafCount > 0 && (
              <button
                onClick={() => setActiveTab('katalog')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-medium transition-transform hover:scale-105 shadow-2xs"
                title={`${drafCount} rekod draf belum disahkan`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{drafCount} Draf</span>
              </button>
            )}

            {/* Review Counter Badge */}
            {reviewCount > 0 && (
              <button
                onClick={() => setActiveTab('katalog')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-medium transition-transform hover:scale-105 shadow-2xs"
                title={`${reviewCount} rekod memerlukan semakan`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{reviewCount} Perlu Semakan</span>
              </button>
            )}

            {/* Dark/Light Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200/50 dark:border-slate-700/50 shadow-2xs"
              title="Tukar Tema (Terang / Gelap)"
              aria-label="Tukar Tema"
            >
              {settings.temaWarna === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>

        {/* Menu Utama Di Atas Sekali */}
        <nav className="py-2.5 overflow-x-auto no-scrollbar flex items-center gap-1 sm:gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{item.label}</span>
                {item.highlight && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

