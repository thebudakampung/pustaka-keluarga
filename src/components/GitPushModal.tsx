import React, { useState, useEffect } from 'react';
import { safeFetchJson } from '../lib/apiUtils';
import {
  GitBranch,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Copy,
  ExternalLink,
  RefreshCw,
  X,
  Check,
  Key,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface GitPushModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitPushModal: React.FC<GitPushModalProps> = ({ isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [githubToken, setGithubToken] = useState(() => {
    return localStorage.getItem('github_pat_token') || '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';
  });
  const [showTokenConfig, setShowTokenConfig] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    output?: string;
    timestamp?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (githubToken) {
      localStorage.setItem('github_pat_token', githubToken.trim());
    }
  }, [githubToken]);

  if (!isOpen) return null;

  const handleGitPush = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const res = await safeFetchJson<any>('/api/git-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commitMessage: commitMessage.trim() || undefined,
          githubToken: githubToken.trim() || undefined,
        }),
      });

      const data = res.data || {};
      const isSuccess = res.ok && data.success;

      setResult({
        success: isSuccess,
        message: data.message || res.error || (isSuccess ? 'Git Push berjaya!' : 'Git Push gagal.'),
        output: data.output || data.error || res.error || '',
        timestamp: data.timestamp || new Date().toISOString(),
      });

      if (!isSuccess) {
        setShowTokenConfig(true);
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Ralat semasa menyambung ke pelayan untuk Git Push.',
        output: String(err),
        timestamp: new Date().toISOString(),
      });
      setShowTokenConfig(true);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="git-push-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-xs">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Git Push ke GitHub</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold">
                  main
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pustaka Keluarga &bull; GitHub Repository Sync
              </p>
            </div>
          </div>
          <button
            id="close-git-modal-btn"
            onClick={onClose}
            disabled={isLoading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Target Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Sasaran Repositori:</span>
              <a
                href="https://github.com/thebudakampung/pustaka-keluarga"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>thebudakampung/pustaka-keluarga</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="font-mono text-[11px] bg-slate-900 text-slate-200 dark:bg-slate-950 p-2.5 rounded-lg overflow-x-auto select-all">
              git remote set-url origin https://github.com/thebudakampung/pustaka-keluarga.git
              <br />
              git push -u origin main
            </div>
          </div>

          {/* Commit Message (Optional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mesej Commit (Pilihan):
            </label>
            <input
              type="text"
              id="git-commit-message-input"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={`Kemas kini kod Pustaka Keluarga (${new Date().toLocaleDateString('ms-MY')})`}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
          </div>

          {/* GitHub Token Configuration */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowTokenConfig(!showTokenConfig)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Tetapan Token GitHub (Personal Access Token)</span>
              </div>
              {showTokenConfig ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showTokenConfig && (
              <div className="p-3.5 border-t border-slate-200 dark:border-slate-700 space-y-3 bg-white dark:bg-slate-900">
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300 text-[11px] space-y-1">
                  <p className="font-bold">🔑 Perlu Jana Personal Access Token (PAT) Baharu:</p>
                  <p>
                    Token GitHub lama telah tamat tempoh atau dibatalkan. Klik butang di bawah untuk menjana token baharu di akaun GitHub anda.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Tampal GitHub Personal Access Token (PAT) di sini:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="github-token-input"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1">
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Pustaka+Keluarga+Sync"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition cursor-pointer shadow-2xs"
                  >
                    <span>Jana Token Baharu di GitHub (1-Klik)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setGithubToken('')}
                    className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer text-xs"
                  >
                    Kosongkan Medan
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Trigger Button */}
          <button
            id="execute-git-push-btn"
            type="button"
            onClick={handleGitPush}
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-md ${
              isLoading
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 active:scale-[0.99]'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-500 dark:text-slate-400" />
                <span>Sedang Menjalankan Git Push ke GitHub...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>JALANKAN GIT PUSH SEKARANG</span>
              </>
            )}
          </button>

          {/* Result / Terminal Output */}
          {result && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-3 animate-in fade-in slide-in-from-top-2 ${
                result.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-xs">
                      {result.success ? 'Git Push Berjaya Selesai!' : 'Git Push Gagal'}
                    </h4>
                    <p className="text-[11px] opacity-90">{result.message}</p>
                  </div>
                </div>
                {result.output && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.output || '')}
                    className="p-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-colors shrink-0 flex items-center gap-1 text-[10px] font-semibold"
                    title="Salin Log Output"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Disalin' : 'Salin Log'}</span>
                  </button>
                )}
              </div>

              {result.output && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    <Terminal className="w-3 h-3" /> Log Terminal:
                  </div>
                  <pre className="font-mono text-[11px] bg-slate-900 text-slate-200 dark:bg-slate-950 p-3 rounded-lg overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                    {result.output}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Token & Cawangan: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">main</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
