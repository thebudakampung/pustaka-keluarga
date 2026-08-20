import React from 'react';
import { History, Search, ShieldCheck } from 'lucide-react';
import { BookRecord, AuditLog } from '../types';

interface AuditTrailProps {
  books: BookRecord[];
  deletedAuditLogs?: (AuditLog & { bookTitle: string })[];
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ books, deletedAuditLogs }) => {
  const [filterQuery, setFilterQuery] = React.useState('');

  // Collect all audit logs from all books
  const allLogs: (AuditLog & { bookTitle: string })[] = [];

  books.forEach((b) => {
    if (b.auditTrail) {
      b.auditTrail.forEach((log) => {
        allLogs.push({
          ...log,
          bookTitle: b.judul,
        });
      });
    }
  });

  if (deletedAuditLogs) {
    allLogs.push(...deletedAuditLogs);
  }

  // Sort logs by timestamp descending
  allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const filteredLogs = allLogs.filter(
    (l) =>
      l.bookTitle.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.field.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.source.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.user.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.newValue.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            <span>Log Audit Perubahan Katalog (Audit Trail)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Rekod lengkap setiap perubahan medan, nilai asal, nilai baharu, sumber cadangan, pengguna dan masa pengesahan.
          </p>
        </div>

        {/* Filter input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Tapis log audit..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-mono">Masa Log</th>
                <th className="py-3.5 px-4">Judul Buku</th>
                <th className="py-3.5 px-4">Medan</th>
                <th className="py-3.5 px-4">Nilai Asal</th>
                <th className="py-3.5 px-4">Nilai Baharu</th>
                <th className="py-3.5 px-4">Sumber</th>
                <th className="py-3.5 px-4">Pengesah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{log.timestamp}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                    {log.bookTitle}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">{log.field}</td>
                  <td className="py-3 px-4 font-mono text-rose-600 dark:text-rose-400 text-[11px]">
                    {log.oldValue || <span className="italic">Kosong</span>}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                    {log.newValue}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-medium">
                      {log.source}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">{log.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
