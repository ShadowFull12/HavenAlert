import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import useVenueStore from '../../store/venueStore';
import { supabase } from '../../lib/supabase';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { formatDistanceToNow } from 'date-fns';

export default function ComplaintsBoard() {
  const { venue } = useVenueStore();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!venue?.id) return;
    fetchComplaints();
    const ch = supabase.channel(`complaints-venue-${venue.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints', filter: `venue_id=eq.${venue.id}` }, () => fetchComplaints())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [venue]);

  const fetchComplaints = async () => {
    const { data } = await supabase.from('complaints')
      .select('*, guest:profiles!complaints_guest_id_fkey(full_name)')
      .eq('venue_id', venue.id).order('created_at', { ascending: false });
    setComplaints(data || []);
    setLoading(false);
  };

  const filtered = filter === 'all' ? complaints : complaints.filter(c => c.status === filter);
  const priorityMap = { urgent: 'critical', high: 'high', normal: 'medium', low: 'low' };

  if (loading) return <Spinner className="py-16" size="lg" />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-haven-dark">Complaints</h1>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {['all', 'open', 'in_progress', 'resolved'].map(t => (
          <button key={t} onClick={() => setFilter(t)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap min-h-[36px] transition-all ${filter === t ? 'bg-white text-haven-dark shadow-sm' : 'text-haven-muted'}`}>
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No complaints" message="No complaints to show." />
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} onClick={() => navigate(`/venue/complaints/${c.id}`)} className="card p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-sm text-haven-dark">{c.title}</h4>
                <div className="flex gap-1">
                  <Badge variant={priorityMap[c.priority] || 'medium'}>{c.priority}</Badge>
                  <Badge variant={c.status === 'resolved' ? 'success' : c.status === 'open' ? 'critical' : 'medium'}>{c.status}</Badge>
                </div>
              </div>
              <p className="text-xs text-haven-muted truncate">{c.description}</p>
              <p className="text-xs text-haven-muted mt-1">{c.guest?.full_name || 'Guest'} • {c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true }) : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
