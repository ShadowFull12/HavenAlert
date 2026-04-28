import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, AlertTriangle, MessageSquare, CheckCircle2,
  Clock, ChevronRight, RefreshCw
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useVenueStore from '../../store/venueStore';
import { supabase } from '../../lib/supabase';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function MyTasks() {
  const { user } = useAuthStore();
  const { venue } = useVenueStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('incidents');
  const [incidents, setIncidents] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState(null);
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
    if (!user?.id) return;
    fetchAll();
    subscribeToUpdates();
  }, [user?.id]);

  const fetchAll = async () => {
    const [incRes, compRes] = await Promise.all([
      supabase.from('incidents')
        .select('*')
        .eq('assigned_to', user.id)
        .not('status', 'in', '("closed")')
        .order('created_at', { ascending: false }),
      supabase.from('complaints')
        .select('*')
        .eq('assigned_to', user.id)
        .not('status', 'in', '("closed")')
        .order('created_at', { ascending: false }),
    ]);
    if (mountedRef.current) {
      setIncidents(incRes.data || []);
      setComplaints(compRes.data || []);
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase.channel(`my-tasks-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `assigned_to=eq.${user.id}` },
        () => { if (mountedRef.current) fetchAll(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'complaints', filter: `assigned_to=eq.${user.id}` },
        () => { if (mountedRef.current) fetchAll(); })
      .subscribe();
    channelRef.current = ch;
  };

  const markIncidentResolved = async (incidentId) => {
    if (!window.confirm('Mark this incident as resolved? The guest will be asked to confirm.')) return;
    setMarkingId(incidentId);
    try {
      const { error } = await supabase.from('incidents')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', incidentId)
        .eq('assigned_to', user.id); // extra safety: staff can only update their own
      if (error) throw error;
      // Log event
      await supabase.from('incident_events').insert({
        incident_id: incidentId,
        actor_id: user.id,
        event_type: 'status_change',
        description: 'Staff marked incident as resolved — awaiting guest confirmation',
      });
      toast.success('Marked as resolved. Guest will be notified to confirm.');
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      if (mountedRef.current) setMarkingId(null);
    }
  };

  const markComplaintResolved = async (complaintId) => {
    if (!window.confirm('Mark this complaint as resolved? The guest will be asked to confirm.')) return;
    setMarkingId(complaintId);
    try {
      const { error } = await supabase.from('complaints')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', complaintId)
        .eq('assigned_to', user.id);
      if (error) throw error;
      toast.success('Marked as resolved. Guest will be notified to confirm.');
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      if (mountedRef.current) setMarkingId(null);
    }
  };

  const getSeverityColor = (severity) => ({
    critical: 'text-red-600 bg-red-50', high: 'text-orange-600 bg-orange-50',
    medium: 'text-yellow-600 bg-yellow-50', low: 'text-green-600 bg-green-50',
  }[severity] || 'text-gray-600 bg-gray-50');

  const getStatusIcon = (status) => {
    if (status === 'resolved') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
  };

  if (loading) return <Spinner className="py-16" size="lg" />;

  const incidentCount = incidents.length;
  const complaintCount = complaints.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-haven-dark">My Tasks</h1>
        <p className="text-sm text-haven-muted mt-1">Incidents and complaints assigned to you</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab('incidents')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all min-h-[36px] flex items-center justify-center gap-2 ${tab === 'incidents' ? 'bg-white text-haven-dark shadow-sm' : 'text-haven-muted'}`}
        >
          <AlertTriangle className="w-4 h-4" />
          Incidents {incidentCount > 0 && <span className="bg-red-100 text-red-600 text-xs rounded-full px-1.5">{incidentCount}</span>}
        </button>
        <button
          onClick={() => setTab('complaints')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all min-h-[36px] flex items-center justify-center gap-2 ${tab === 'complaints' ? 'bg-white text-haven-dark shadow-sm' : 'text-haven-muted'}`}
        >
          <MessageSquare className="w-4 h-4" />
          Complaints {complaintCount > 0 && <span className="bg-blue-100 text-blue-600 text-xs rounded-full px-1.5">{complaintCount}</span>}
        </button>
      </div>

      {/* Incidents list */}
      {tab === 'incidents' && (
        incidents.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No assigned incidents" message="You have no incidents assigned to you right now." />
        ) : (
          <div className="space-y-3">
            {incidents.map(inc => (
              <div key={inc.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {getStatusIcon(inc.status)}
                      <h3 className="font-semibold text-sm text-haven-dark">{inc.title}</h3>
                    </div>
                    <p className="text-xs text-haven-muted line-clamp-2 mb-2">{inc.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSeverityColor(inc.severity)}`}>
                        {inc.severity}
                      </span>
                      <Badge variant={inc.status}>{inc.status?.replace(/_/g, ' ')}</Badge>
                      {inc.location_text && <span className="text-xs text-haven-muted">📍 {inc.location_text}</span>}
                      <span className="text-xs text-haven-muted ml-auto">
                        {format(new Date(inc.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons — staff can ONLY mark as resolved */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => navigate(`/venue/incidents/${inc.id}`)}
                    className="flex items-center gap-1 text-xs text-haven-muted hover:text-haven-dark"
                  >
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <div className="ml-auto">
                    {inc.status === 'resolved' ? (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Awaiting guest confirmation
                      </span>
                    ) : (
                      <button
                        onClick={() => markIncidentResolved(inc.id)}
                        disabled={markingId === inc.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {markingId === inc.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Complaints list */}
      {tab === 'complaints' && (
        complaints.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No assigned complaints" message="You have no complaints assigned to you right now." />
        ) : (
          <div className="space-y-3">
            {complaints.map(comp => (
              <div key={comp.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(comp.status)}
                      <h3 className="font-semibold text-sm text-haven-dark">{comp.title}</h3>
                    </div>
                    <p className="text-xs text-haven-muted line-clamp-2 mb-2">{comp.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={comp.priority || 'medium'}>{comp.priority || 'medium'}</Badge>
                      <Badge variant={comp.status}>{comp.status?.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-haven-muted ml-auto">
                        {format(new Date(comp.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => navigate(`/venue/complaints/${comp.id}`)}
                    className="flex items-center gap-1 text-xs text-haven-muted hover:text-haven-dark"
                  >
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <div className="ml-auto">
                    {comp.status === 'resolved' ? (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Awaiting guest confirmation
                      </span>
                    ) : (
                      <button
                        onClick={() => markComplaintResolved(comp.id)}
                        disabled={markingId === comp.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {markingId === comp.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
