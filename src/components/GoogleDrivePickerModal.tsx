import React, { useState, useEffect } from 'react';
import {
  initAuth,
  googleSignIn,
  fetchDriveItems,
  downloadDriveImageAsBase64,
  DriveImageFile,
  DriveFolderBreadcrumb,
} from '../lib/googleDriveAuth';
import { User } from 'firebase/auth';
import {
  X,
  Check,
  Image as ImageIcon,
  Loader2,
  Cloud,
  AlertCircle,
  ShieldAlert,
  Copy,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Folder,
  FolderOpen,
  FolderUp,
  ChevronRight,
  Search,
  Grid,
  Layers,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage?: (base64Url: string, fileName: string) => void;
  onSelectImages?: (images: { base64: string; name: string }[]) => void;
  multiple?: boolean;
}

export const GoogleDrivePickerModal: React.FC<GoogleDrivePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  onSelectImages,
  multiple = false,
}) => {
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);

  // Folder & file state
  const [folders, setFolders] = useState<DriveImageFile[]>([]);
  const [files, setFiles] = useState<DriveImageFile[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<DriveFolderBreadcrumb[]>([
    { id: 'root', name: 'Drive Saya' },
  ]);
  const [viewMode, setViewMode] = useState<'folder' | 'all-images'>('folder');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedFile, setSelectedFile] = useState<DriveImageFile | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<DriveImageFile[]>([]);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [driveApiError, setDriveApiError] = useState<{ isError: boolean; activationUrl: string } | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentFolder = breadcrumbs[breadcrumbs.length - 1] || { id: 'root', name: 'Drive Saya' };
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isUnauthorizedDomain = errorMsg?.includes('Authorized Domains') || errorMsg?.includes('unauthorized-domain');

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = initAuth(
      (usr, tkn) => {
        setUser(usr);
        setToken(tkn);
        setNeedsAuth(false);
        loadCurrentFolder(tkn, currentFolder.id, searchQuery, viewMode);
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
        setToken(null);
      }
    );
    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  const loadCurrentFolder = async (
    accessToken: string,
    folderId: string,
    query: string = '',
    mode: 'folder' | 'all-images' = 'folder'
  ) => {
    setIsLoadingFiles(true);
    setErrorMsg(null);
    setDriveApiError(null);
    try {
      const result = await fetchDriveItems(accessToken, folderId, query, mode);
      setFolders(result.folders);
      setFiles(result.images);
    } catch (err: any) {
      console.error('Error loading drive items:', err);
      const errMsg = err?.message || String(err);
      if (
        err?.code === 'DRIVE_API_DISABLED' ||
        errMsg.includes('Google Drive API') ||
        errMsg.includes('SERVICE_DISABLED') ||
        errMsg.includes('drive.googleapis.com') ||
        errMsg.includes('accessNotConfigured')
      ) {
        setDriveApiError({
          isError: true,
          activationUrl:
            err.activationUrl ||
            'https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=99140129213',
        });
      } else {
        setErrorMsg(errMsg || 'Gagal memuat senarai fail dari Google Drive');
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleFolderClick = (folder: DriveImageFile) => {
    const newBreadcrumbs = [...breadcrumbs, { id: folder.id, name: folder.name }];
    setBreadcrumbs(newBreadcrumbs);
    setSelectedFile(null);
    if (token) {
      loadCurrentFolder(token, folder.id, searchQuery, viewMode);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === breadcrumbs.length - 1) return;
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setSelectedFile(null);
    const targetFolder = newBreadcrumbs[newBreadcrumbs.length - 1];
    if (token) {
      loadCurrentFolder(token, targetFolder.id, searchQuery, viewMode);
    }
  };

  const handleGoUp = () => {
    if (breadcrumbs.length <= 1) return;
    handleBreadcrumbClick(breadcrumbs.length - 2);
  };

  const handleViewModeChange = (newMode: 'folder' | 'all-images') => {
    setViewMode(newMode);
    setSelectedFile(null);
    if (token) {
      loadCurrentFolder(token, currentFolder.id, searchQuery, newMode);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token) {
      loadCurrentFolder(token, currentFolder.id, searchQuery, viewMode);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        setNeedsAuth(false);
        await loadCurrentFolder(res.accessToken, currentFolder.id, searchQuery, viewMode);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      const code = err?.code || '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        msg.includes('popup-closed-by-user') ||
        msg.includes('cancelled-popup-request')
      ) {
        setErrorMsg(null);
      } else {
        console.warn('Login issue:', msg);
        setErrorMsg(msg || 'Log masuk Google tidak berjaya.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleFileClick = (file: DriveImageFile) => {
    if (multiple) {
      const exists = selectedFiles.some((f) => f.id === file.id);
      if (exists) {
        setSelectedFiles(selectedFiles.filter((f) => f.id !== file.id));
      } else {
        if (selectedFiles.length >= 2) {
          setSelectedFiles([selectedFiles[0], file]);
        } else {
          setSelectedFiles([...selectedFiles, file]);
        }
      }
    } else {
      setSelectedFile(file);
    }
  };

  const handleConfirmSelect = async () => {
    if (!token) return;
    if (multiple && selectedFiles.length === 0) return;
    if (!multiple && !selectedFile) return;

    setIsDownloading(true);
    setErrorMsg(null);
    try {
      if (multiple && onSelectImages) {
        const results = await Promise.all(
          selectedFiles.map(async (f) => {
            const base64 = await downloadDriveImageAsBase64(f.id, token);
            return { base64, name: f.name };
          })
        );
        onSelectImages(results);
        onClose();
      } else if (selectedFile && onSelectImage) {
        const base64 = await downloadDriveImageAsBase64(selectedFile.id, token);
        onSelectImage(base64, selectedFile.name);
        onClose();
      }
    } catch (err: any) {
      console.error('Download error:', err);
      setErrorMsg(err.message || 'Gagal memuat turun imej dari Google Drive');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="google-drive-picker-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDownloading) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <span>Pilih Gambar dari Google Drive</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Navigasi Folder
                </span>
              </h3>
              <p className="text-xs text-slate-500">Layari folder Google Drive anda atau pilih fail imej kulit buku</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar (Search, Breadcrumbs, Mode Toggles) */}
        {!needsAuth && (
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] relative">
                <input
                  type="text"
                  id="drive-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama fail atau folder..."
                  className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      if (token) loadCurrentFolder(token, currentFolder.id, '', viewMode);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  id="view-folder-mode-btn"
                  onClick={() => handleViewModeChange('folder')}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'folder'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Ikut Folder</span>
                </button>
                <button
                  type="button"
                  id="view-all-mode-btn"
                  onClick={() => handleViewModeChange('all-images')}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'all-images'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Semua Gambar</span>
                </button>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => token && loadCurrentFolder(token, currentFolder.id, searchQuery, viewMode)}
                disabled={isLoadingFiles}
                title="Muat semula folder semasa"
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>

            {/* Breadcrumb path navigation (Only in folder mode) */}
            {viewMode === 'folder' && (
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1 scrollbar-none">
                {breadcrumbs.length > 1 && (
                  <button
                    type="button"
                    onClick={handleGoUp}
                    title="Naik Satu Tingkat"
                    className="p-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer mr-1"
                  >
                    <FolderUp className="w-4 h-4" />
                  </button>
                )}

                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id + idx}>
                      {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <button
                        type="button"
                        onClick={() => handleBreadcrumbClick(idx)}
                        disabled={isLast}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md whitespace-nowrap transition cursor-pointer ${
                          isLast
                            ? 'font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800'
                            : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {idx === 0 ? <Cloud className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
                        <span>{crumb.name}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto">
          {errorMsg && !isUnauthorizedDomain && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isUnauthorizedDomain && (
            <div className="mb-5 p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-slate-800 dark:text-slate-200 text-xs space-y-3.5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-bold text-amber-950 dark:text-amber-200 text-sm">
                    Domain Perlu Didaftarkan dalam Firebase Auth (Authorized Domains)
                  </h5>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                    Untuk keselamatan OAuth, Google Firebase memerlukan domain web ini didaftarkan dalam senarai <strong>Authorized Domains</strong> sebelum membenarkan tetingkap log masuk Google Drive.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/70 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Domain Semasa Anda:</span>
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                  <code className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 select-all break-all px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                    {currentHostname}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(currentHostname);
                      setCopiedDomain(true);
                      setTimeout(() => setCopiedDomain(false), 2500);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs transition cursor-pointer shrink-0 shadow-xs"
                  >
                    {copiedDomain ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDomain ? 'Berjaya Disalin!' : 'Salin Domain'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">Cara Daftar Domain (Pantas 30 Saat):</p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-xs text-slate-600 dark:text-slate-300">
                  <li>Buka konsol Firebase Authentication Settings projek anda.</li>
                  <li>Di bahagian <strong>"Authorized domains"</strong>, klik <strong>"Add domain"</strong>.</li>
                  <li>Tampal nama domain di atas (<code>{currentHostname}</code>) dan klik <strong>Save</strong>.</li>
                </ol>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <span>Buka Konsol Firebase (Authorized Domains)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={handleLogin}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Cuba Log Masuk Semula</span>
                </button>
              </div>
            </div>
          )}

          {driveApiError?.isError && (
            <div className="mb-5 p-4 sm:p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 text-slate-800 dark:text-slate-200 text-xs space-y-3.5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-bold text-indigo-950 dark:text-indigo-200 text-sm">
                    Google Drive API Perlu Diaktifkan di Google Cloud Console
                  </h5>
                  <p className="text-xs text-indigo-900/80 dark:text-indigo-300 mt-1 leading-relaxed">
                    Akaun anda telah berjaya log masuk, namun Google Cloud memerlukan perkhidmatan <strong>Google Drive API</strong> diaktifkan untuk projek ini (<code className="font-mono font-bold">99140129213</code>) bagi membolehkan aplikasi membaca fail dan folder Google Drive.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/70">
                <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">Langkah Aktifkan API (1 Minit):</p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-xs text-slate-600 dark:text-slate-300">
                  <li>Klik butang biru <strong>"Aktifkan Google Drive API di Google Cloud"</strong> di bawah.</li>
                  <li>Di halaman Google Cloud, klik butang biru <strong>"ENABLE"</strong> (atau <strong>"AKTIFKAN"</strong>).</li>
                  <li>Tunggu 30 saat untuk Google mengemaskini sistem, kemudian klik butang <strong>"Muat Semula Senarai Fail"</strong> di bawah.</li>
                </ol>
              </div>

              <div className="pt-1 flex flex-wrap items-center gap-2.5">
                <a
                  href={driveApiError.activationUrl || "https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=99140129213"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <span>Aktifkan Google Drive API di Google Cloud</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => token && loadCurrentFolder(token, currentFolder.id, searchQuery, viewMode)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Muat Semula Senarai Fail</span>
                </button>
              </div>
            </div>
          )}

          {needsAuth ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shadow-inner">
                <Cloud className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1">Sambungkan Google Drive</h4>
                <p className="text-xs text-slate-500 mb-6">
                  Sila log masuk dengan akaun Google anda untuk membenarkan aplikasi mengakses dan memilih fail imej dari Google Drive.
                </p>
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="gsi-material-button inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  <div className="gsi-material-button-icon w-5 h-5 mr-2.5">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span>{isLoggingIn ? 'Sedang Log Masuk...' : 'Log Masuk dengan Google'}</span>
                </button>
              </div>
            </div>
          ) : isLoadingFiles ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-slate-500">Memuat fail &amp; folder dari Google Drive...</p>
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {searchQuery ? `Tiada folder atau imej sepadan dengan "${searchQuery}"` : 'Folder ini kosong atau tiada fail imej'}
              </p>
              <p className="text-xs text-slate-400">
                {viewMode === 'folder'
                  ? 'Cuba pilih folder lain di bar navigasi atas atau tukar ke mod "Semua Gambar".'
                  : 'Pastikan akaun Google Drive anda mengandungi fail berformat imej (JPG, PNG, WebP).'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Section 1: Subfolders (If in Folder mode and subfolders exist) */}
              {viewMode === 'folder' && folders.length > 0 && (
                <div className="space-y-2.5">
                  <h6 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-amber-500" />
                    <span>Folder ({folders.length})</span>
                  </h6>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        onClick={() => handleFolderClick(folder)}
                        className="group p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition cursor-pointer flex items-center gap-2.5 shadow-2xs"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Folder className="w-4 h-4 fill-amber-500/20" />
                        </div>
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate flex-1" title={folder.name}>
                          {folder.name}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Image Files */}
              {files.length > 0 && (
                <div className="space-y-2.5">
                  <h6 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Fail Imej ({files.length})</span>
                  </h6>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {files.map((file) => {
                      const selIndex = multiple
                        ? selectedFiles.findIndex((f) => f.id === file.id)
                        : selectedFile?.id === file.id
                        ? 0
                        : -1;
                      const isSelected = selIndex !== -1;
                      return (
                        <div
                          key={file.id}
                          onClick={() => handleFileClick(file)}
                          className={`group relative rounded-xl border p-2 flex flex-col items-center text-center cursor-pointer transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="w-full h-32 rounded-lg bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center mb-2 relative">
                            {file.thumbnailLink ? (
                              <img
                                src={file.thumbnailLink}
                                alt={file.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-slate-400" />
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-indigo-600/20 backdrop-blur-2xs flex items-center justify-center">
                                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md font-bold text-xs">
                                  {multiple ? `${selIndex + 1}` : <Check className="w-4 h-4" />}
                                </div>
                              </div>
                            )}
                          </div>
                          <span
                            className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate w-full px-1"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 truncate max-w-sm">
            {multiple ? (
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                {selectedFiles.length === 0
                  ? 'Sila pilih 2 gambar (1: Muka Depan, 2: Hak Cipta)'
                  : selectedFiles.map((f, i) => `${i === 0 ? '1 (Muka Depan)' : '2 (Hak Cipta)'}: ${f.name}`).join(' | ')}
              </span>
            ) : selectedFile ? (
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                Dipilih: {selectedFile.name}
              </span>
            ) : user ? (
              <span>Akaun: {user.email}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            {!needsAuth && (
              <button
                type="button"
                onClick={handleConfirmSelect}
                disabled={multiple ? selectedFiles.length === 0 || isDownloading : !selectedFile || isDownloading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDownloading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isDownloading
                    ? 'Memuat turun...'
                    : multiple
                    ? `Guna ${selectedFiles.length} Gambar Ini`
                    : 'Guna Gambar Ini'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
