import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Trash2, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../store/authStore';
import useVenueStore from '../../store/venueStore';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { logAudit } from '../../lib/audit';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const canManage = (profile) => ['owner', 'manager'].includes(profile?.role);

export default function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { venue } = useVenueStore();
  const [complaint, setComplaint] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState('');
  const { messages, loading: msgsLoading, bottomRef } = useRealtimeMessages('complaint_messages', 'complaint_id', id);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const isManager = canManage(profile);

  useEffect(() => {
    fetchData();
    // Realtime updates for the complaint itself
    const ch = supabase.channel(`complaint-detail-${id}-${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'complaints', filter: `id=eq.${id}` },
        (p) => { if (p.new) setComplaint(prev => ({ ...prev, ...p.new })); })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [id]);

  const fetchData = async () => {
    const [cRes, sRes] = await Promise.all([
      supabase.from('complaints').select('*, guest:profiles!complaints_guest_id_fkey(full_name)').eq('id', id).single(),
      supabase.from('staff_members').select('*, profile:profiles(full_name)').eq('venue_id', venue?.id).eq('is_active', true),
    ]);
    setComplaint(cRes.data);
    setStaff(sRes.data || []);
    setResolution(cRes.data?.resolution_notes || '');
    setLoading(false);
  };

  const updateComplaint = async (field, value) => {
    if (!isManager) { toast.error('Only managers can modify complaints'); return; }
    const { error } = await supabase.from('complaints').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Update failed'); return; }
    setComplaint(prev => ({ ...prev, [field]: value }));
    await logAudit({ venueId: venue.id, actorId: user.id, actorRole: profile.role, action: `complaint_${field}_update`, resourceType: 'complaint', resourceId: id });
    toast.success('Updated');
  };

  // Manager close — can force-close or wait for guest confirmation
  const handleClose = async () => {
    if (!isManager) return;
    if (!complaint.confirmed_resolved_by_guest) {
      if (!window.confirm('Guest has not confirmed resolution yet. Force-close this complaint anyway?')) return;
    }
    setClosing(true);
    const { error } = await supabase.from('complaints')
      .update({
        status: 'closed',
        resolution_notes: resolution,
        closed_by: user.id,
        closed_at: new Date().toISOString()
      })
      .eq('id', id);
    if (error) { toast.error('Close failed'); setClosing(false); return; }
    setComplaint(prev => ({ ...prev, status: 'closed' }));
    toast.success('Complaint closed!');
    setClosing(false);
  };

  // Manager delete
  const handleDelete = async () => {
    if (!isManager) return;
    if (!window.confirm('Permanently delete this complaint? This cannot be undone.')) return;
    const { error } = await supabase.from('complaints').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Complaint deleted');
    navigate('/venue/complaints');
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      await supabase.from('complaint_messages').insert({
        complaint_id: id, sender_id: user.id, message: newMsg.trim(), is_staff: true
      });
      setNewMsg('');
    } catch (err) { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  if (loading) return <Spinner className="py-16" size="lg" />;
  if (!complaint) return <p className="text-center py-16 text-haven-muted">Not found</p>;

  const awaitingConfirm = complaint.status === 'resolved' && !complaint.confirmed_resolved_by_guest;
  const guestConfirmed = complaint.confirmed_resolved_by_guest;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/venue/complaints')} className="flex items-center gap-2 text-haven-muted text-sm hover:text-haven-dark">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-haven-dark">{complaint.title}</h1>
          <p className="text-sm text-haven-muted mt-1">by {complaint.guest?.full_name || 'Guest'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={complaint.status === 'resolved' || complaint.status === 'closed' ? 'success' : 'critical'}>
            {complaint.status?.replace(/_/g, ' ')}
          </Badge>
          <Badge variant="medium">{complaint.category}</Badge>
          {guestConfirmed && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ Guest Confirmed</span>
          )}
          {isManager && complaint.status !== 'closed' && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 text-haven-muted hover:text-red-500 transition-colors"
              title="Delete complaint"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Close banner for resolved complaints */}
      {isManager && complaint.status === 'resolved' && (
        <div className={`card p-4 flex items-center justify-between ${guestConfirmed ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <div>
            {guestConfirmed ? (
              <>
                <p className="text-sm font-semibold text-green-800">✅ Guest confirmed — ready to close</p>
                <p className="text-xs text-green-600 mt-0.5">You can permanently close this complaint.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-800">⏳ Awaiting guest confirmation</p>
                <p className="text-xs text-amber-600 mt-0.5">Guest has been notified. You can also force-close.</p>
              </>
            )}
          </div>
          <Button
            onClick={handleClose}
            loading={closing}
            className={`text-sm ${guestConfirmed ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'} text-white`}
          >
            Close Complaint
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-sm text-haven-dark leading-relaxed">{complaint.description}</p>
          </div>

          {/* Manager controls */}
          {isManager ? (
            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-haven-muted uppercase tracking-wider">Manager Controls</p>

              <div>
                <label className="label-caption block mb-1">Status</label>
                <select value={complaint.status} onChange={(e) => updateComplaint('status', e.target.value)} className="input-field">
                  <option value="open">Open</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  {complaint.status === 'resolved' && <option value="resolved" disabled>Resolved (awaiting close)</option>}
                  {complaint.status === 'closed' && <option value="closed" disabled>Closed</option>}
                </select>
              </div>

              <div>
                <label className="label-caption block mb-1">Priority</label>
                <select value={complaint.priority || 'normal'} onChange={(e) => updateComplaint('priority', e.target.value)} className="input-field">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="label-caption block mb-1">Assign To (auto-sets status)</label>
                <select value={complaint.assigned_to || ''} onChange={(e) => updateComplaint('assigned_to', e.target.value || null)} className="input-field">
                  <option value="">Unassigned</option>
                  {staff.map(s => <option key={s.profile_id} value={s.profile_id}>{s.profile?.full_name}</option>)}
                </select>
                <p className="text-xs text-haven-muted mt-1">Assigning → status becomes "Assigned". Removing → reverts to "Open".</p>
              </div>

              <div>
                <label className="label-caption block mb-1">Resolution Notes</label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="input-field min-h-[80px]"
                  placeholder="Add resolution notes..."
                />
              </div>
            </div>
          ) : (
            <div className="card p-4 flex items-center gap-3 text-haven-muted bg-gray-50">
              <Lock className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-haven-dark">Read-Only View</p>
                <p className="text-xs">Only managers can modify complaints. Mark as resolved from <strong>My Tasks</strong>.</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="card overflow-hidden" style={{ minHeight: '400px' }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-haven-dark">Messages</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 p-4 max-h-[300px]">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.sender_id === user?.id
                    ? 'bg-haven-dark text-white rounded-br-md'
                    : msg.is_staff
                    ? 'bg-blue-50 text-blue-900 rounded-bl-md'
                    : 'bg-gray-100 text-haven-dark rounded-bl-md'
                }`}>
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-[10px] opacity-50 mt-1">{msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={sendMessage} className="border-t border-gray-100 p-3 flex gap-2">
            <input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Reply..."
              className="input-field flex-1"
            />
            <button type="submit" disabled={!newMsg.trim() || sending} className="btn-primary px-3 min-w-[44px] min-h-[44px]">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
