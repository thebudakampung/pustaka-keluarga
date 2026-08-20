import React from 'react';
import {
  LayoutDashboard,
  BookMarked,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Printer,
  History,
  Settings as SettingsIcon,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'katalog', label: 'Katalog Buku', icon: BookMarked },
    { id: 'tambah', label: 'Tambah Buku (AI OCR)', icon: PlusCircle, highlight: true },
    { id: 'import', label: 'Import Data', icon: FileSpreadsheet },
    { id: 'export', label: 'Eksport Data', icon: Download },
    { id: 'cetak', label: 'Cetak Label Tulang', icon: Printer },
    { id: 'audit', label: 'Log Audit', icon: History },
    { id: 'tetapan', label: 'Tetapan', icon: SettingsIcon },
  ];

  return (
    <aside className="w-full md:w-64 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col justify-between shrink-0 h-fit">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          Menu Utama
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
              {item.highlight && !isActive && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info Box */}
      <div className="mt-8 p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Kataloger AI Vision
          </span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Sistem sokong OCR Bahasa Melayu, Inggeris & Arab. Semua imbasan disimpan sebagai Draf dahulu.
        </p>
      </div>
    </aside>
  );
};
