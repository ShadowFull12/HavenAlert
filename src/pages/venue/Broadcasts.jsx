import React, { useState, useEffect, useRef } from 'react';
import { Megaphone, Send, Trash2 } from 'lucide-react';
import useVenueStore from '../../store/venueStore';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Broadcasts() {
  const { venue } = useVenueStore();
  const { user } = useAuthStore();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', message: '', target_audience: 'all' });
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const channelRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    if (!venue?.id) { setLoading(false); return; }

    fetchBroadcasts();

    const ch = supabase
      .channel(`mgr-broadcasts-${venue.id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts', filter: `venue_id=eq.${venue.id}` },
        () => { if (mountedRef.current) fetchBroadcasts(); })
      .subscribe();
    channelRef.current = ch;
  }, [venue?.id]);

  const fetchBroadcasts = async () => {
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*, sender:profiles!broadcasts_sent_by_fkey(full_name)')
      .eq('venue_id', venue.id)
      .order('created_at', { ascending: false });
    if (!mountedRef.current) return;
    if (!error) setBroadcasts(data || []);
    setLoading(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) { toast.error('Please fill in all fields'); return; }
    setSending(true);
    try {
      const { error } = await supabase.from('broadcasts').insert({
        venue_id: venue.id,
        sent_by: user.id,
        title: form.title,
        message: form.message,
        target_audience: form.target_audience,
      });
      if (error) throw error;
      setForm({ title: '', message: '', target_audience: 'all' });
      toast.success('Broadcast sent!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this broadcast?')) return;
    setDeletingId(id);
    const { error } = await supabase.from('broadcasts').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Broadcast deleted');
      setBroadcasts(prev => prev.filter(b => b.id !== id));
    }
    if (mountedRef.current) setDeletingId(null);
  };

  if (loading) return <Spinner className="py-16" size="lg" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-haven-dark">Broadcasts</h1>

      {/* Send form */}
      <form onSubmit={handleSend} className="card p-5 space-y-4">
        <h3 className="font-semibold text-sm text-haven-dark">Send Announcement</h3>
        <Input
          label="Title"
          placeholder="e.g. Pool Closure Notice"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <div>
          <label className="block text-xs font-medium text-haven-muted mb-1.5">Message</label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="input-field min-h-[80px] resize-none"
            placeholder="Write your announcement..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-haven-muted mb-1.5">Audience</label>
          <select
            value={form.target_audience}
            onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
            className="input-field"
          >
            <option value="all">Everyone (Staff + Guests)</option>
            <option value="staff">Staff Only</option>
            <option value="guests">Guests Only</option>
          </select>
        </div>
        <Button type="submit" loading={sending} className="w-full flex items-center justify-center gap-2">
          <Send className="w-4 h-4" /> Send Broadcast
        </Button>
      </form>

      {/* History */}
      <div>
        <h3 className="font-semibold text-haven-dark mb-3">
          History
          {broadcasts.length > 0 && (
            <span className="ml-2 text-xs font-normal text-haven-muted">({broadcasts.length} total)</span>
          )}
        </h3>
        {broadcasts.length === 0 ? (
          <EmptyState icon={Megaphone} title="No broadcasts yet" message="Send your first announcement above." />
        ) : (
          <div className="space-y-2">
            {broadcasts.map(b => (
              <div key={b.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm text-haven-dark">{b.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.target_audience === 'all' ? 'bg-blue-100 text-blue-700' :
                        b.target_audience === 'staff' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {b.target_audience === 'all' ? 'Everyone' : b.target_audience === 'staff' ? 'Staff' : 'Guests'}
                      </span>
                    </div>
                    <p className="text-sm text-haven-muted mt-1">{b.message}</p>
                    <p className="text-xs text-haven-muted mt-2">
                      {b.sender?.full_name || 'Staff'} · {b.created_at ? format(new Date(b.created_at), 'MMM d, HH:mm') : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(b.id)}
                    disabled={deletingId === b.id}
                    className="p-2 rounded-lg text-haven-muted hover:text-danger hover:bg-danger-light transition-colors flex-shrink-0"
                    title="Delete broadcast"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
