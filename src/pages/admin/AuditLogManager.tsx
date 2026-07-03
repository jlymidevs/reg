import { useEffect, useState } from 'react';
import { FileClock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { getAuditLogs } from '../../lib/api';
import type { AuditLog } from '../../lib/api';

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-[#10B981]/10 text-[#10B981]',
  UPDATE: 'bg-secondary text-primary',
  DELETE: 'bg-error/10 text-error',
};

export default function AuditLogManager() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');

  useEffect(() => {
    getAuditLogs()
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const targetTypes = Array.from(new Set(logs.map((l) => l.target_type)));

  const filtered = logs.filter((log) => {
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;
    const matchesTarget = targetFilter === 'all' || log.target_type === targetFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (log.actor_email || '').toLowerCase().includes(searchLower) ||
      log.target_type.toLowerCase().includes(searchLower);
    return matchesAction && matchesTarget && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text mb-1">Audit Log</h2>
        <p className="text-sm text-text-muted">Every event, registration, and admin-access change — append-only.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-2xl shadow-card border border-border">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Search by admin email or table..."
            className="input pl-10 bg-background/50 border-border/50 text-sm rounded-xl focus:bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select className="input bg-background/50 border-border/50 text-sm rounded-xl cursor-pointer hover:bg-white" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="all">All Actions</option>
            <option value="INSERT">Created</option>
            <option value="UPDATE">Updated</option>
            <option value="DELETE">Deleted</option>
          </select>
          <select className="input bg-background/50 border-border/50 text-sm rounded-xl cursor-pointer hover:bg-white" value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)}>
            <option value="all">All Tables</option>
            {targetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="card shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Loading audit log...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileClock size={48} className="mx-auto text-text-muted mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-text mb-2">No log entries found</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-background/80 border-b border-border text-xs text-text-muted uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">When</th>
                  <th className="px-6 py-4">Admin</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Table</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-text-muted whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-text">{log.actor_email || 'system'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 uppercase rounded-md ${ACTION_COLORS[log.action_type] || 'bg-gray-100 text-gray-500'}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text">{log.target_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
