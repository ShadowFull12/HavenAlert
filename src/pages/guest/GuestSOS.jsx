import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EyeOff, AlertTriangle, CheckCircle2, Clock, Shield,
  ChevronRight, ThumbsUp, ThumbsDown, RefreshCw
} from 'lucide-react';
import SOSButton from '../../components/incidents/SOSButton';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { generateBriefing } from '../../lib/gemini';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

const INCIDENT_TYPES = [
  { value: 'medical',  label: 'Medical',  emoji: '🏥' },
  { value: 'fire',     label: 'Fire',     emoji: '🔥' },
  { value: 'security', label: 'Security', emoji: '🔒' },
  { value: 'other',    label: 'Other',    emoji: '⚠️' },
];

const STATUS_CONFIG = {
  open:        { label: 'Received',    color: 'text-blue-600',   bg: 'bg-blue-100',   icon: '📋', step: 1 },
  assigned:    { label: 'Assigned',    color: 'text-purple-600', bg: 'bg-purple-100', icon: '👷', step: 2 },
  in_progress: { label: 'In Progress', color: 'text-amber-600',  bg: 'bg-amber-100',  icon: '⚙️', step: 3 },
  escalated:   { label: 'Escalated',  color: 'text-red-600',    bg: 'bg-red-100',    icon: '🔺', step: 3 },
  resolved:    { label: 'Resolved',   color: 'text-green-600',  bg: 'bg-green-100',  icon: '✅', step: 4 },
  closed:      { label: 'Closed',     color: 'text-gray-600',   bg: 'bg-gray-100',   icon: '🔒', step: 5 },
};

const STEPS = ['Received', 'Assigned', 'In Progress', 'Resolved'];

export default function GuestSOS() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState('other');
  const [isSilent, setIsSilent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeIncident, setActiveIncident] = useState(null); // current open/active incident
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
    fetchActiveIncident();
  }, [profile?.id]);

  const fetchActiveIncident = async () => {
    // Find the most recent non-closed incident reported by this guest
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('reported_by', profile.id)
      .not('status', 'eq', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mountedRef.current) {
      setActiveIncident(data || null);
      setInitialLoading(false);
      if (data) subscribeToIncident(data.id);
    }
  };

  const subscribeToIncident = (incidentId) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase.channel(`sos-track-${incidentId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${incidentId}`
      }, (p) => {
        if (mountedRef.current && p.new) setActiveIncident(prev => ({ ...prev, ...p.new }));
      })
      .subscribe();
    channelRef.current = ch;
  };

  const handleSOS = async () => {
    if (!profile?.venue_id) { toast.error('Please check into a venue first'); return; }
    setLoading(true);
    const incidentData = {
      venue_id: profile.venue_id,
      reported_by: profile.id,
      room_id: profile.room_id,
      title: `SOS — ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Emergency`,
      description: `Guest triggered SOS alert. Type: ${selectedType}`,
      type: selectedType,
      severity: 'critical',
      status: 'open',
      is_silent: isSilent,
      location_text: profile.room_id ? `Room assigned` : 'Unknown location',
    };
    try {
      const { data: incident, error } = await supabase.from('incidents').insert(incidentData).select().single();
      if (error) throw error;

      await supabase.from('incident_events').insert({
        incident_id: incident.id, actor_id: profile.id, event_type: 'created',
        description: `SOS alert triggered by guest — ${selectedType} emergency`,
      });

      if (mountedRef.current) {
        setActiveIncident(incident);
        subscribeToIncident(incident.id);
        setLoading(false);
      }
      toast.success('SOS sent! Help is on the way.');

      // Background AI briefing
      Promise.resolve().then(async () => {
        try {
          const briefing = await generateBriefing(incident, profile.medical_profile);
          await supabase.from('incidents').update({ ai_briefing: briefing }).eq('id', incident.id);
        } catch {}
      });
    } catch (err) {
      const pending = JSON.parse(localStorage.getItem('pendingSOS') || '[]');
      pending.push({ ...incidentData, _created: Date.now() });
      localStorage.setItem('pendingSOS', JSON.stringify(pending));
      toast('SOS saved offline — will retry automatically', { icon: '📡' });
      setLoading(false);
    }
  };

  const confirmResolved = async () => {
    if (!activeIncident) return;
    setConfirmingId('confirm');
    try {
      const { error } = await supabase.from('incidents')
        .update({ confirmed_resolved_by_guest: true, confirmed_resolved_at: new Date().toISOString() })
        .eq('id', activeIncident.id);
      if (error) throw error;
      if (mountedRef.current) setActiveIncident(prev => ({ ...prev, confirmed_resolved_by_guest: true }));
      toast.success('Thanks! The manager will close this incident.');
    } catch (err) { toast.error(err.message); }
    finally { if (mountedRef.current) setConfirmingId(null); }
  };

  const disputeResolved = async () => {
    if (!activeIncident) return;
    setConfirmingId('dispute');
    try {
      const { error } = await supabase.from('incidents')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', activeIncident.id);
      if (error) throw error;
      if (mountedRef.current) setActiveIncident(prev => ({ ...prev, status: 'in_progress' }));
      toast('Issue re-opened. Staff has been notified.', { icon: '🔄' });
    } catch (err) { toast.error(err.message); }
    finally { if (mountedRef.current) setConfirmingId(null); }
  };

  if (initialLoading) return <Spinner className="py-24" size="lg" />;

  // ── Active incident tracker view ──────────────────────────────────────────
  if (activeIncident && activeIncident.status !== 'closed') {
    const cfg = STATUS_CONFIG[activeIncident.status] || STATUS_CONFIG.open;
    const currentStep = cfg.step;
    const awaitingConfirm = activeIncident.status === 'resolved' && !activeIncident.confirmed_resolved_by_guest;
    const confirmed = activeIncident.confirmed_resolved_by_guest;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full ${cfg.bg} flex items-center justify-center text-3xl mx-auto mb-3`}>
            {cfg.icon}
          </div>
          <h2 className="text-xl font-bold text-haven-dark">Your SOS is Active</h2>
          <p className="text-sm text-haven-muted mt-1">{activeIncident.title}</p>
        </div>

        {/* Status pill */}
        <div className={`flex items-center justify-center gap-2 ${cfg.bg} rounded-full py-2 px-5 mx-auto w-fit`}>
          <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
          {activeIncident.status !== 'resolved' && (
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ color: 'currentColor' }} />
          )}
        </div>

        {/* Progress steps */}
        <div className="card p-5">
          <div className="flex items-center justify-between relative">
            {/* Track line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" />
            <div
              className="absolute top-4 left-0 h-0.5 bg-green-500 z-0 transition-all duration-500"
              style={{ width: `${Math.min(((currentStep - 1) / (STEPS.length - 1)) * 100, 100)}%` }}
            />
            {STEPS.map((label, idx) => {
              const stepNum = idx + 1;
              const done = stepNum < currentStep;
              const active = stepNum === currentStep;
              return (
                <div key={label} className="flex flex-col items-center z-10 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done ? 'bg-green-500 border-green-500 text-white' :
                    active ? 'bg-white border-haven-dark text-haven-dark ring-4 ring-haven-dark/10' :
                    'bg-white border-gray-200 text-gray-300'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
                  </div>
                  <p className={`text-[10px] mt-1.5 text-center font-medium ${active ? 'text-haven-dark' : done ? 'text-green-600' : 'text-gray-300'}`}>
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resolution confirmation */}
        {awaitingConfirm && (
          <div className="card p-5 border-amber-300 bg-amber-50">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Staff says this is resolved</p>
                <p className="text-sm text-amber-700 mt-0.5">Has your issue actually been taken care of?</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmResolved}
                disabled={!!confirmingId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50"
              >
                {confirmingId === 'confirm' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                Yes, resolved!
              </button>
              <button
                onClick={disputeResolved}
                disabled={!!confirmingId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-100 text-red-700 text-sm font-medium rounded-xl hover:bg-red-200 disabled:opacity-50"
              >
                {confirmingId === 'dispute' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                Not fixed yet
              </button>
            </div>
          </div>
        )}

        {confirmed && (
          <div className="card p-4 bg-green-50 border-green-200 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-800 font-medium">You confirmed this is resolved. Manager will close it shortly.</p>
          </div>
        )}

        {/* View details link */}
        <button
          onClick={() => navigate(`/guest/incident/${activeIncident.id}`)}
          className="w-full card p-4 flex items-center justify-between text-sm text-haven-muted hover:text-haven-dark"
        >
          View incident details & chat
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Safety tip while waiting */}
        <div className="card p-4 flex items-start gap-3 bg-blue-50 border-blue-100">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900">While you wait</p>
            <p className="text-xs text-blue-700 mt-0.5">Stay calm and in a safe location. Staff has been alerted and is responding.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── SOS send form (no active incident or incident is closed) ──────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8">
      <SOSButton onClick={handleSOS} loading={loading} />

      {/* Type selector chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {INCIDENT_TYPES.map(({ value, label, emoji }) => (
          <button
            key={value}
            onClick={() => setSelectedType(value)}
            className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-150 min-h-[44px] ${
              selectedType === value ? 'bg-haven-dark text-white' : 'bg-gray-100 text-haven-muted hover:bg-gray-200'
            }`}
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* Silent mode */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          className={`w-11 h-6 rounded-full relative transition-colors duration-150 ${isSilent ? 'bg-haven-dark' : 'bg-gray-200'}`}
          onClick={() => setIsSilent(!isSilent)}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-150 ${isSilent ? 'translate-x-5' : ''}`} />
        </div>
        <div className="flex items-center gap-1.5">
          <EyeOff className="w-4 h-4 text-haven-muted" />
          <span className="text-sm text-haven-muted">Silent — no alerts on my device</span>
        </div>
      </label>
    </div>
  );
}
