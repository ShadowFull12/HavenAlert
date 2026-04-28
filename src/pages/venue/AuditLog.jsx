import React, { useState, useEffect } from 'react';
import { ScrollText, Download, ChevronDown, ChevronUp } from 'lucide-react';
import useVenueStore from '../../store/venueStore';
import { supabase } from '../../lib/supabase';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { format } from 'date-fns';

export default function AuditLog() {
  const { venue } = useVenueStore();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => { if (venue?.id) fetchLogs(); }, [venue, page]);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, count } = await supabase.from('audit_log')
      .select('*, actor:profiles!audit_log_actor_id_fkey(full_name)', { count: 'exact' })
      .eq('venue_id', venue.id)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    setLogs(data || []);
    setTotal(count || 0);
    setLoading(false);
  };

  const exportCSV = () => {
    const headers = ['Timestamp,Actor,Role,Action,Resource Type,Resource ID'];
    const rows = logs.map(l => `${l.created_at},${l.actor?.full_name || ''},${l.actor_role || ''},${l.action},${l.resource_type || ''},${l.resource_id || ''}`);
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-log-${venue.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && logs.length === 0) return <Spinner className="py-16" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-haven-dark">Audit Log</h1>
        <Button variant="secondary" onClick={exportCSV} className="text-sm"><Download className="w-4 h-4" /> Export CSV</Button>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" message="Actions will be logged here automatically." />
      ) : (
        <>
          {/* Mobile: card list / Desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-haven-muted">Time</th>
                  <th className="px-4 py-3 font-medium text-haven-muted">Actor</th>
                  <th className="px-4 py-3 font-medium text-haven-muted">Role</th>
                  <th className="px-4 py-3 font-medium text-haven-muted">Action</th>
                  <th className="px-4 py-3 font-medium text-haven-muted">Resource</th>
                  <th className="px-4 py-3 font-medium text-haven-muted"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <React.Fragment key={l.id}>
                    <tr className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}>
                      <td className="px-4 py-3 whitespace-nowrap">{l.created_at ? format(new Date(l.created_at), 'MMM d, HH:mm:ss') : ''}</td>
                      <td className="px-4 py-3">{l.actor?.full_name || '—'}</td>
                      <td className="px-4 py-3 capitalize">{l.actor_role || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
                      <td className="px-4 py-3">{l.resource_type || '—'}</td>
                      <td className="px-4 py-3">{expandedId === l.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</td>
                    </tr>
                    {expandedId === l.id && (
                      <tr><td colSpan={6} className="px-4 py-3 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div><p className="font-medium text-haven-muted mb-1">Before</p><pre className="bg-white p-2 rounded overflow-auto max-h-32">{JSON.stringify(l.before_state, null, 2) || 'null'}</pre></div>
                          <div><p className="font-medium text-haven-muted mb-1">After</p><pre className="bg-white p-2 rounded overflow-auto max-h-32">{JSON.stringify(l.after_state, null, 2) || 'null'}</pre></div>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {logs.map(l => (
              <div key={l.id} className="card p-4">
                <p className="text-xs text-haven-muted">{l.created_at ? format(new Date(l.created_at), 'MMM d, HH:mm') : ''}</p>
                <p className="font-semibold text-sm text-haven-dark mt-1">{l.action}</p>
                <p className="text-xs text-haven-muted">{l.actor?.full_name || 'System'} • {l.actor_role}</p>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-haven-muted">Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPage(p => p - 1)} disabled={page === 0} className="text-sm">Previous</Button>
              <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= total} className="text-sm">Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
