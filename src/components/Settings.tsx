import React, { useRef, useState } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Trash2, Download, Upload, ShieldCheck, Sun, Moon, Database, CloudCheck, Lock, Unlock, KeyRound, X, GitBranch, UploadCloud } from 'lucide-react';
import { LibrarySettings, BookRecord } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface SettingsProps {
  settings: LibrarySettings;
  onUpdateSettings: (newSettings: LibrarySettings) => void;
  onResetSeedData: () => void;
  onClearAllData: () => void;
  books: BookRecord[];
  deletedAuditLogs: any[];
  onRestoreBackup: (backupData: { books: BookRecord[]; settings: LibrarySettings; deletedAuditLogs?: any[] }) => void;
  onSyncToFirebase?: () => Promise<void>;
  isSyncingFirebase?: boolean;
  onOpenGitPush?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  onResetSeedData,
  onClearAllData,
  books,
  deletedAuditLogs,
  onRestoreBackup,
  onSyncToFirebase,
  isSyncingFirebase = false,
  onOpenGitPush,
}) => {
  const [formData, setFormData] = React.useState<LibrarySettings>(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    alert('Tetapan perpustakaan berjaya disimpan!');
  };

  const handleDownloadBackup = () => {
    const backupObject = {
      appName: 'Sistem Pengurusan Perpustakaan MADANI',
      version: '1.0',
      timestamp: new Date().toISOString(),
      settings,
      books,
      deletedAuditLogs,
    };
    const jsonString = JSON.stringify(backupObject, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Sandaran_Sistem_Perpustakaan_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [pendingBackup, setPendingBackup] = useState<{
    books: BookRecord[];
    settings: LibrarySettings;
    deletedAuditLogs?: any[];
  } | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '123') {
      setIsUnlocked(true);
      setShowUnlockModal(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('Kata laluan salah! Sila cuba lagi.');
    }
  };

  const handleFileUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && parsed.books && parsed.settings) {
          setPendingBackup({
            books: parsed.books,
            settings: parsed.settings,
            deletedAuditLogs: parsed.deletedAuditLogs || [],
          });
        } else {
          alert('Format fail sandaran tidak sah. Sila gunakan fail JSON sandaran perpustakaan yang betul.');
        }
      } catch (err: any) {
        alert(`Ralat membaca fail sandaran: ${err.message}`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-emerald-600" />
          <span>Tetapan Sistem & Konfigurasi AI</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Tetapkan maklumat institusi, ambang keyakinan OCR Vision, dan kawalan pangkalan data.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Perpustakaan
            </label>
            <input
              type="text"
              value={formData.namaPerpustakaan}
              onChange={(e) => setFormData({ ...formData, namaPerpustakaan: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Kod Sistem Perpustakaan
            </label>
            <input
              type="text"
              value={formData.kodPerpustakaan}
              onChange={(e) => setFormData({ ...formData, kodPerpustakaan: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ambang Keyakinan OCR (&lt; {formData.ambangConfidence}% Ditanda &quot;Perlu Semakan&quot;)
            </label>
            <input
              type="range"
              min={50}
              max={95}
              value={formData.ambangConfidence}
              onChange={(e) => setFormData({ ...formData, ambangConfidence: parseInt(e.target.value) })}
              className="w-full accent-emerald-600"
            />
            <span className="text-xs font-bold text-emerald-600 block mt-1">{formData.ambangConfidence}%</span>
          </div>


          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tema Paparan Sistem
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const updated = { ...formData, temaWarna: 'light' };
                  setFormData(updated);
                  onUpdateSettings(updated);
                }}
                className={`flex-1 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                  formData.temaWarna === 'light'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Tema Terang</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...formData, temaWarna: 'dark' };
                  setFormData(updated);
                  onUpdateSettings(updated);
                }}
                className={`flex-1 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                  formData.temaWarna === 'dark'
                    ? 'bg-slate-900 text-slate-100 border-slate-900 dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Tema Gelap</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs shadow-2xs hover:opacity-90 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Tetapan</span>
          </button>
        </div>
      </form>

      {/* Firebase Cloud Sync Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-900/50 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100 tracking-wider flex items-center gap-2">
                <span>Pangkalan Data Cloud (Firebase Firestore)</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[10px] font-semibold lowercase">
                  live sync
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Semua rekod katalog ({books.length} buah buku) diselaraskan secara automatik ke pangkalan data cloud Firebase Firestore supaya boleh dicapai oleh pengguna awam dalam talian.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <CloudCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Status: <strong>Tersambung ke Firebase Realtime Firestore</strong></span>
          </div>
          {onSyncToFirebase && (
            <button
              type="button"
              onClick={onSyncToFirebase}
              disabled={isSyncingFirebase}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
              <span>{isSyncingFirebase ? 'Memuat Naik...' : 'Simpan / Sync Semua Ke Firebase'}</span>
            </button>
          )}
        </div>
      </div>

      {/* GitHub Git Push Repository Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100 tracking-wider flex items-center gap-2">
                <span>Penyegerakan GitHub (Git Push Repository)</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold font-mono">
                  main
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Tolak (Push) semua kod sumber dan pengubahsuaian terkini terus ke repositori GitHub <code className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">thebudakampung/pustaka-keluarga</code>.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <GitBranch className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">Cawangan: <strong>origin/main</strong></span>
          </div>
          {onOpenGitPush && (
            <button
              type="button"
              id="settings-git-push-btn"
              onClick={onOpenGitPush}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>GIT PUSH KE GITHUB</span>
            </button>
          )}
        </div>
      </div>

      {/* Safe Backup & Restoration Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                Sandaran & Pemulihan Selamat (Safe Backup & Restore)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Jamin tiada kehilangan data dengan memuat turun fail sandaran penuh atau memulihkannya pada bila-bila masa.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
            Aktif & Selamat
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Download Backup */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Muat Turun Sandaran Sistem (.JSON)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Simpan salinan penuh semua rekod buku, konfigurasi, dan log audit anda ke komputer.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="w-full py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-2xs hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Muat Turun Sandaran</span>
            </button>
          </div>

          {/* Restore Backup */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Pulihkan Data Daripada Fail Sandaran
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Muat naik fail sandaran JSON terdahulu untuk memulihkan katalog dan tetapan perpustakaan.
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUploadBackup}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs shadow-2xs hover:opacity-90 transition-colors flex items-center justify-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              <span>Pilih Fail & Pulihkan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset & Database Management Section */}
      <div className={`p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 transition-opacity ${isUnlocked ? 'opacity-100' : 'opacity-90'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-2">
              <span>Pengurusan Data & Pemulihan</span>
              {!isUnlocked && (
                <span className="text-[11px] font-normal normal-case text-amber-600 dark:text-amber-400">
                  (Dimatikan)
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isUnlocked
                ? 'Sistem bersedia untuk tetapan semula atau pengosongan data.'
                : 'Fungsi ini dimatikan secara lalai untuk mengelakkan kehilangan data yang tidak disengajakan.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isUnlocked ? (
              <>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  <span>Aktif</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsUnlocked(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                  title="Matikan & Kunci Semula"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Matikan / Kunci</span>
                </button>
              </>
            ) : (
              <>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Dimatikan</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordInput('');
                    setPasswordError('');
                    setShowUnlockModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Hidupkan (Masukkan Password)</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div>
            <h4 className={`text-xs font-bold ${isUnlocked ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'} flex items-center gap-1.5`}>
              <span>Pulihkan Contoh Rekod Asal (Reset Seed Data)</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isUnlocked
                ? 'Muat semula koleksi contoh buku perpustakaan ke dalam pangkalan data.'
                : 'Muat semula koleksi contoh buku. (Sila hidupkan / nyahkunci dahulu dengan kata laluan 123).'}
            </p>
          </div>
          {isUnlocked ? (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Muat Semula Seed Data</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              onClick={() => setShowUnlockModal(true)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 text-xs font-semibold cursor-not-allowed flex items-center gap-1.5 shrink-0 opacity-70"
              title="Fungsi ini dimatikan. Klik 'Hidupkan' dan masukkan password 123."
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Dimatikan</span>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <h4 className={`text-xs font-bold ${isUnlocked ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
              Kosongkan Semua Pangkalan Data
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isUnlocked
                ? 'Padam semua rekod buku dan log audit daripada sistem.'
                : 'Padam semua rekod buku dan log audit. (Sila hidupkan / nyahkunci dahulu dengan kata laluan 123).'}
            </p>
          </div>
          {isUnlocked ? (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kosongkan Pangkalan Data</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 text-xs font-semibold cursor-not-allowed flex items-center gap-1.5 shrink-0 opacity-70"
              title="Fungsi ini dimatikan. Klik 'Hidupkan' dan masukkan password 123."
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Dimatikan</span>
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={pendingBackup !== null}
        title="Pulihkan Sandaran Data"
        message={`Adakah anda pasti untuk memulihkan sandaran ini? Sebanyak ${pendingBackup?.books.length || 0} rekod buku akan dimuatkan.`}
        confirmLabel="Pulihkan Sandaran"
        variant="warning"
        onConfirm={() => {
          if (pendingBackup) {
            onRestoreBackup(pendingBackup);
            setPendingBackup(null);
          }
        }}
        onCancel={() => setPendingBackup(null)}
      />

      <ConfirmModal
        isOpen={showResetModal}
        title="Pulihkan Contoh Rekod Asal"
        message="Adakah anda pasti untuk memuatkan semula koleksi contoh buku? Data contoh asal akan ditambahkan semula ke dalam pangkalan data."
        confirmLabel="Muat Semula Data"
        variant="warning"
        onConfirm={() => {
          onResetSeedData();
          setShowResetModal(false);
          alert('✓ Contoh rekod asal berjaya dimuatkan semula!');
        }}
        onCancel={() => setShowResetModal(false)}
      />

      <ConfirmModal
        isOpen={showClearModal}
        title="Kosongkan Pangkalan Data"
        message="PERHATIAN: Adakah anda pasti untuk memadam semua rekod buku dan log audit? Tindakan ini tidak boleh dibatalkan."
        confirmLabel="Padam Semua Data"
        variant="danger"
        onConfirm={() => {
          onClearAllData();
          setShowClearModal(false);
          alert('✓ Semua pangkalan data telah dikosongkan.');
        }}
        onCancel={() => setShowClearModal(false)}
      />

      {/* Password Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full p-6 space-y-4 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Pengesahan Kata Laluan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Sila masukkan kata laluan keselamatan untuk mengaktifkan fungsi Pengurusan Data & Pemulihan.
            </p>

            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kata Laluan
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Masukkan kata laluan (contoh: 123)"
                  autoFocus
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {passwordError && (
                  <p className="text-[11px] text-rose-500 font-medium mt-1">
                    {passwordError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Hidupkan / Nyahkunci</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
