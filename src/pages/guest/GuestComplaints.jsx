import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../store/authStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import {
  MessageSquare, Plus, ThumbsUp, ThumbsDown,
  CheckCircle2, Clock, RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_COLOR = {
  open:        'bg-blue-100 text-blue-700',
  assigned:    'bg-purple-100 text-purple-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved:    'bg-green-100 text-green-700',
  closed:      'bg-gray-100 text-gray-600',
};

const STATUS_LABEL = {
  open: 'Open', assigned: 'Assigned', in_progress: 'In Progress',
  resolved: 'Resolved', closed: 'Closed',
};

export default function GuestComplaints() {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'general' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
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
    if (!profile?.id) return;
    fetchComplaints();
    subscribeToComplaints();
  }, [profile?.id]);

  const fetchComplaints = async () => {
    const { data } = await supabase
      .from('complaints').select('*')
      .eq('guest_id', profile.id)
      .order('created_at', { ascending: false });
    if (mountedRef.current) { setComplaints(data || []); setLoading(false); }
  };

  const subscribeToComplaints = () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase.channel(`complaints-guest-${profile.id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints', filter: `guest_id=eq.${profile.id}` },
        () => { if (mountedRef.current) fetchComplaints(); })
      .subscribe();
    channelRef.current = ch;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) { toast.error('Fill in all fields'); return; }
    if (!profile?.venue_id) { toast.error('Check in to a venue first'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('complaints').insert({
        venue_id: profile.venue_id, guest_id: profile.id, room_id: profile.room_id,
        title: form.title, description: form.description, category: form.category,
      });
      if (error) throw error;
      setForm({ title: '', description: '', category: 'general' });
      setShowNew(false);
      toast.success('Complaint submitted');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmResolved = async (complaint) => {
    setConfirmingId(complaint.id + '_confirm');
    try {
      const { error } = await supabase.from('complaints')
        .update({ confirmed_resolved_by_guest: true, confirmed_resolved_at: new Date().toISOString() })
        .eq('id', complaint.id);
      if (error) throw error;
      toast.success('Thanks for confirming! Manager will close this.');
      fetchComplaints();
    } catch (err) { toast.error(err.message); }
    finally { if (mountedRef.current) setConfirmingId(null); }
  };

  const disputeResolved = async (complaint) => {
    setConfirmingId(complaint.id + '_dispute');
    try {
      const { error } = await supabase.from('complaints')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', complaint.id);
      if (error) throw error;
      toast('Complaint re-opened. Staff has been notified.', { icon: '🔄' });
      fetchComplaints();
    } catch (err) { toast.error(err.message); }
    finally { if (mountedRef.current) setConfirmingId(null); }
  };

  if (loading) return <Spinner className="py-16" />;

  const pendingCount = complaints.filter(c => c.status === 'resolved' && !c.confirmed_resolved_by_guest).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-haven-dark">My Complaints</h2>
          {pendingCount > 0 && (
            <p className="text-xs text-amber-600 mt-0.5 font-medium">
              ⚠️ {pendingCount} complaint{pendingCount > 1 ? 's' : ''} awaiting your confirmation
            </p>
          )}
        </div>
        <Button onClick={() => setShowNew(true)} className="text-sm">
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {complaints.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No complaints"
          message="Everything going well? Great!"
          action="Submit a Complaint"
          onAction={() => setShowNew(true)}
        />
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => {
            const needsConfirm = c.status === 'resolved' && !c.confirmed_resolved_by_guest;
            const alreadyConfirmed = c.status === 'resolved' && c.confirmed_resolved_by_guest;
            return (
              <div
                key={c.id}
                className={`card p-4 ${needsConfirm ? 'border-amber-300 bg-amber-50' : ''}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-semibold text-sm text-haven-dark leading-tight">{c.title}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                </div>

                <p className="text-xs text-haven-muted mb-2 line-clamp-2">{c.description}</p>

                <div className="flex items-center justify-between text-[10px] text-haven-muted mb-1">
                  <span className="capitalize">{c.category}</span>
                  <span>{c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true }) : ''}</span>
                </div>

                {/* Status indicator */}
                {c.status === 'in_progress' && (
                  <div className="flex items-center gap-1.5 text-amber-600 text-xs mt-1">
                    <Clock className="w-3.5 h-3.5 animate-pulse" /> Being handled by staff
                  </div>
                )}
                {c.status === 'assigned' && (
                  <div className="flex items-center gap-1.5 text-purple-600 text-xs mt-1">
                    <Clock className="w-3.5 h-3.5" /> Staff assigned
                  </div>
                )}
                {alreadyConfirmed && (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> You confirmed this resolved
                  </div>
                )}

                {/* Confirmation action */}
                {needsConfirm && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Staff marked this resolved — is it fixed?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmResolved(c)}
                        disabled={!!confirmingId}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {confirmingId === c.id + '_confirm'
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <ThumbsUp className="w-3.5 h-3.5" />}
                        Yes, fixed!
                      </button>
                      <button
                        onClick={() => disputeResolved(c)}
                        disabled={!!confirmingId}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 disabled:opacity-50"
                      >
                        {confirmingId === c.id + '_dispute'
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <ThumbsDown className="w-3.5 h-3.5" />}
                        Still an issue
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="New Complaint">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            placeholder="Brief description"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div>
            <label className="label-caption block mb-1.5">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">
              <option value="general">General</option>
              <option value="cleanliness">Cleanliness</option>
              <option value="noise">Noise</option>
              <option value="service">Service</option>
              <option value="amenities">Amenities</option>
              <option value="safety">Safety</option>
            </select>
          </div>
          <div>
            <label className="label-caption block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[100px]"
              placeholder="Describe the issue in detail"
            />
          </div>
          <Button type="submit" loading={submitting} className="w-full">Submit Complaint</Button>
        </form>
      </Modal>
    </div>
  );
}
