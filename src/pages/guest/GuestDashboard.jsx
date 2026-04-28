import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, AlertTriangle, MessageSquare, Shield,
  CheckCircle, Clock, Megaphone, LogOut, CheckCircle2, ThumbsUp, ThumbsDown
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function GuestDashboard() {
  const { profile, refreshProfile } = useAuthStore();
  const navigate = useNavigate();

  const [venueCode, setVenueCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState(null);
  const [checkInTime, setCheckInTime] = useState(null); // when guest joined queue
  const [venue, setVenue] = useState(null);
  const [room, setRoom] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [pendingResolutions, setPendingResolutions] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);

  const queueChannelRef = useRef(null);
  const broadcastChannelRef = useRef(null);
  const mountedRef = useRef(true);

  // Reset mountedRef on every mount (handles React StrictMode double-invoke)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (queueChannelRef.current) { supabase.removeChannel(queueChannelRef.current); queueChannelRef.current = null; }
      if (broadcastChannelRef.current) { supabase.removeChannel(broadcastChannelRef.current); broadcastChannelRef.current = null; }
    };
  }, []);

  // Load all data when profile changes
  useEffect(() => {
    if (!profile?.id) return;
    loadAll();
  }, [profile?.id, profile?.venue_id, profile?.room_id]);

  const loadAll = async () => {
    // Load venue
    if (profile.venue_id) {
      const { data } = await supabase.from('venues').select('*').eq('id', profile.venue_id).maybeSingle();
      if (data && mountedRef.current) setVenue(data);
    }

    // Load room
    if (profile.room_id) {
      const { data } = await supabase.from('rooms').select('*').eq('id', profile.room_id).maybeSingle();
      if (data && mountedRef.current) setRoom(data);
    }

    // Check queue record (get check-in time)
    const { data: queueData } = await supabase
      .from('guest_queue')
      .select('*')
      .eq('guest_id', profile.id)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!mountedRef.current) return;

    if (queueData) {
      setQueueStatus(queueData.status);
      setCheckInTime(queueData.created_at);
      subscribeToQueue(profile.id);

      // Load broadcasts sent after check-in
      if (profile.venue_id) {
        loadBroadcasts(profile.venue_id, queueData.created_at);
        subscribeToBroadcasts(profile.venue_id);
      }
      // Load any pending resolution confirmations
      loadPendingResolutions(profile.id);
    }
  };

  const loadBroadcasts = async (venueId, since) => {
    const { data } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('venue_id', venueId)
      .in('target_audience', ['all', 'guests'])
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (mountedRef.current) setBroadcasts(data || []);
  };

  const loadPendingResolutions = async (userId) => {
    const [incRes, compRes] = await Promise.all([
      supabase.from('incidents').select('id, title').eq('reported_by', userId).eq('status', 'resolved').eq('confirmed_resolved_by_guest', false),
      supabase.from('complaints').select('id, title').eq('guest_id', userId).eq('status', 'resolved').eq('confirmed_resolved_by_guest', false),
    ]);
    if (mountedRef.current) {
      setPendingResolutions([
        ...(incRes.data || []).map(i => ({ ...i, kind: 'incident' })),
        ...(compRes.data || []).map(c => ({ ...c, kind: 'complaint' })),
      ]);
    }
  };

  const confirmResolved = async (item) => {
    setConfirmingId(item.id + '_confirm');
    try {
      const table = item.kind === 'incident' ? 'incidents' : 'complaints';
      const { error } = await supabase.from(table)
        .update({ confirmed_resolved_by_guest: true, confirmed_resolved_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) throw error;
      setPendingResolutions(prev => prev.filter(r => r.id !== item.id));
      toast.success('Thanks for confirming! The manager will close this issue.');
    } catch (err) { toast.error(err.message); }
    finally { if (mountedRef.current) setConfirmingId(null); }
  };

  const disputeResolved = async (item) => {
    setConfirmingId(item.id + '_dispute');
    try {
      const table = item.kind === 'incident' ? 'incidents' : 'complaints';
      const { error } = await supabase.from(table)
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) throw error;
      setPendingResolutions(prev => prev.filter(r => r.id !== item.id));
      toast('Issue re-opened. Staff has been notified.', { icon: '🔄' });
    } catch (err) { toast.error(err.message); }
    finally { if (mountedRef.current) setConfirmingId(null); }
  };

  const subscribeToBroadcasts = (venueId) => {
    if (broadcastChannelRef.current) { supabase.removeChannel(broadcastChannelRef.current); }

    const ch = supabase
      .channel(`guest-bcast-${venueId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'broadcasts',
        filter: `venue_id=eq.${venueId}`,
      }, (payload) => {
        if (!mountedRef.current) return;
        const b = payload.new;
        if (b.target_audience === 'all' || b.target_audience === 'guests') {
          setBroadcasts(prev => [b, ...prev]);
          toast(`📢 ${b.title}: ${b.message}`, { duration: 8000 });
        }
      })
      .subscribe();

    broadcastChannelRef.current = ch;
  };

  const subscribeToQueue = (guestId) => {
    if (queueChannelRef.current) { supabase.removeChannel(queueChannelRef.current); }

    const ch = supabase
      .channel(`queue-guest-${guestId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'guest_queue',
        filter: `guest_id=eq.${guestId}`,
      }, async (payload) => {
        if (!mountedRef.current) return;
        if (payload.new.status === 'approved') {
          setQueueStatus('approved');
          await refreshProfile();
          toast.success("You've been assigned a room!");
        }
      })
      .subscribe();

    queueChannelRef.current = ch;
  };

  // Check-in handler
  const handleJoinVenue = async (e) => {
    e.preventDefault();
    const code = venueCode.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    try {
      const { data: venueData, error: venueError } = await supabase
        .from('venues')
        .select('id, name, venue_code, type, city, country')
        .eq('venue_code', code)
        .maybeSingle();

      if (venueError) throw new Error(`Lookup failed: ${venueError.message}`);
      if (!venueData) throw new Error('Invalid venue code. Please check and try again.');

      const { error: profileError } = await supabase
        .from('profiles').update({ venue_id: venueData.id }).eq('id', profile.id);
      if (profileError) throw new Error(`Profile update failed: ${profileError.message}`);

      const { error: queueError } = await supabase
        .from('guest_queue')
        .upsert({ venue_id: venueData.id, guest_id: profile.id, status: 'pending' }, { onConflict: 'venue_id,guest_id' });
      if (queueError) throw new Error(`Queue error: ${queueError.message}`);

      if (mountedRef.current) {
        setVenue(venueData);
        setQueueStatus('pending');
        subscribeToQueue(profile.id);
        await refreshProfile();
        toast.success('Checked in! Waiting for room assignment.');
      }
    } catch (err) {
      if (mountedRef.current) toast.error(err.message || 'Check-in failed');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Checkout handler — clears venue, room, broadcasts
  const handleCheckout = async () => {
    if (!window.confirm('Are you sure you want to check out?')) return;
    setCheckoutLoading(true);
    try {
      // Update queue to checked_out
      await supabase
        .from('guest_queue')
        .update({ status: 'checked_out' })
        .eq('guest_id', profile.id)
        .eq('venue_id', profile.venue_id);

      // Clear room occupancy
      if (profile.room_id) {
        await supabase.from('rooms').update({ current_guest_id: null }).eq('id', profile.room_id);
      }

      // Clear guest's profile venue + room
      await supabase.from('profiles').update({ venue_id: null, room_id: null }).eq('id', profile.id);

      // Clear local state
      if (mountedRef.current) {
        setVenue(null); setRoom(null); setQueueStatus(null);
        setCheckInTime(null); setBroadcasts([]);
        if (queueChannelRef.current) { supabase.removeChannel(queueChannelRef.current); queueChannelRef.current = null; }
        if (broadcastChannelRef.current) { supabase.removeChannel(broadcastChannelRef.current); broadcastChannelRef.current = null; }
        await refreshProfile();
        toast.success('Checked out successfully. Safe travels!');
      }
    } catch (err) {
      toast.error(err.message || 'Checkout failed');
    } finally {
      if (mountedRef.current) setCheckoutLoading(false);
    }
  };

  // ─── VIEWS ──────────────────────────────────────────────────────────────────

  // No venue — show check-in form
  if (!profile?.venue_id && !queueStatus) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-haven-dark">Welcome, {profile?.full_name}</h2>
          <p className="text-sm text-haven-muted mt-1">Enter your venue code to check in</p>
        </div>
        <form onSubmit={handleJoinVenue} className="card p-6 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-info-light flex items-center justify-center mx-auto mb-2">
            <Building2 className="w-8 h-8 text-info" />
          </div>
          <Input
            label="Venue Code"
            placeholder="e.g. GRAND123"
            value={venueCode}
            onChange={(e) => setVenueCode(e.target.value.toUpperCase())}
            className="text-center text-lg font-mono tracking-widest"
          />
          <Button type="submit" loading={loading} className="w-full">
            {loading ? 'Checking in...' : 'Check In'}
          </Button>
        </form>
      </div>
    );
  }

  // In queue — waiting for room
  if (queueStatus === 'pending' && !profile?.room_id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-haven-dark">{venue?.name || 'Your Venue'}</h2>
            <p className="text-sm text-haven-muted mt-1">Checked in — awaiting room</p>
          </div>
          <button onClick={handleCheckout} disabled={checkoutLoading}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 p-2">
            <LogOut className="w-3.5 h-3.5" /> Check Out
          </button>
        </div>
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-warning-light flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-warning animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold text-haven-dark mb-2">Waiting for Room Assignment</h3>
          <p className="text-sm text-haven-muted">Staff will assign you a room shortly. This page updates in real time.</p>
        </div>
        <BroadcastsSection broadcasts={broadcasts} />
      </div>
    );
  }

  // Full dashboard (has room)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-haven-dark">{venue?.name || 'Your Venue'}</h2>
          {room && <p className="text-sm text-haven-muted mt-1">Room {room.room_number}</p>}
        </div>
        <button onClick={handleCheckout} disabled={checkoutLoading}
          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 p-2">
          <LogOut className="w-3.5 h-3.5" /> {checkoutLoading ? 'Checking out...' : 'Check Out'}
        </button>
      </div>

      {room && (
        <div className="card p-4 flex items-center gap-3 bg-success-light border-success/20">
          <CheckCircle className="w-5 h-5 text-success" />
          <span className="text-sm font-medium text-success-dark">Room {room.room_number} — Checked In</span>
        </div>
      )}

      {/* Pending resolution confirmations */}
      {pendingResolutions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-haven-muted uppercase tracking-wider">Action Required</p>
          {pendingResolutions.map(item => (
            <div key={item.id} className="card p-4 border-l-4 border-amber-400 bg-amber-50">
              <div className="flex items-start gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Has this been resolved?</p>
                  <p className="text-xs text-amber-700 mt-0.5">Staff marked &ldquo;{item.title}&rdquo; as resolved.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => confirmResolved(item)}
                  disabled={!!confirmingId}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <ThumbsUp className="w-3.5 h-3.5" /> Yes, resolved!
                </button>
                <button
                  onClick={() => disputeResolved(item)}
                  disabled={!!confirmingId}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 disabled:opacity-50"
                >
                  <ThumbsDown className="w-3.5 h-3.5" /> Not fixed yet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => navigate('/guest/sos')} className="card p-5 text-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-danger-light flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <span className="text-sm font-semibold text-haven-dark">SOS</span>
          <p className="text-xs text-haven-muted mt-1">Emergency alert</p>
        </button>

        <button onClick={() => navigate('/guest/complaints')} className="card p-5 text-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-info-light flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-6 h-6 text-info" />
          </div>
          <span className="text-sm font-semibold text-haven-dark">Complaints</span>
          <p className="text-xs text-haven-muted mt-1">Report an issue</p>
        </button>

        <button onClick={() => navigate('/guest/profile')} className="card p-5 text-center hover:shadow-md transition-shadow col-span-2">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-haven-muted" />
          </div>
          <span className="text-sm font-semibold text-haven-dark">Safety Info & Profile</span>
          <p className="text-xs text-haven-muted mt-1">Medical profile & preferences</p>
        </button>
      </div>

      <BroadcastsSection broadcasts={broadcasts} />
    </div>
  );
}

// ─── Broadcasts Section Component ───────────────────────────────────────────
function BroadcastsSection({ broadcasts }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-haven-muted" />
        <h3 className="text-sm font-semibold text-haven-dark">Venue Announcements</h3>
        {broadcasts.length > 0 && (
          <span className="ml-auto text-xs text-haven-muted">{broadcasts.length} message{broadcasts.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {broadcasts.length === 0 ? (
        <div className="card p-5 text-center">
          <Megaphone className="w-8 h-8 text-haven-muted mx-auto mb-2 opacity-40" />
          <p className="text-xs text-haven-muted">No announcements yet</p>
          <p className="text-xs text-haven-muted opacity-60 mt-0.5">Venue announcements will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {broadcasts.map((b) => (
            <div key={b.id} className="card p-4 border-l-4 border-info">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-haven-dark">{b.title}</h4>
                <span className="text-xs text-haven-muted whitespace-nowrap flex-shrink-0">
                  {format(new Date(b.created_at), 'HH:mm')}
                </span>
              </div>
              <p className="text-sm text-haven-muted mt-1">{b.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
