import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, RefreshCw, Download, Lock, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import useVenueStore from '../../store/venueStore';
import useAuthStore from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { generateBriefing, generateIncidentReport } from '../../lib/gemini';

import { logAudit } from '../../lib/audit';
import IncidentChat from '../../components/incidents/IncidentChat';
import AuditTrail from '../../components/incidents/AuditTrail';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

export default function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { venue } = useVenueStore();
  const { user, profile } = useAuthStore();
  const { can } = usePermissions();
  const canManageIncidents = can('manage_incidents');
  const canDeleteIncidents = can('delete_incidents');
  const [incident, setIncident] = useState(null);
  const [events, setEvents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    fetchData();
    const ch = supabase.channel(`incident-${id}-${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${id}` }, (p) => {
        if (p.new) setIncident(prev => ({ ...prev, ...p.new }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incident_events', filter: `incident_id=eq.${id}` }, () => fetchEvents())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [id]);

  const fetchData = async () => {
    const [incRes, evRes, staffRes] = await Promise.all([
      supabase.from('incidents').select('*, assignee:profiles!incidents_assigned_to_fkey(full_name)').eq('id', id).single(),
      supabase.from('incident_events').select('*').eq('incident_id', id).order('created_at', { ascending: true }),
      supabase.from('staff_members').select('*, profile:profiles(full_name)').eq('venue_id', venue?.id).eq('is_active', true),
    ]);
    setIncident(incRes.data);
    setEvents(evRes.data || []);
    setStaff(staffRes.data || []);
    setLoading(false);
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from('incident_events').select('*').eq('incident_id', id).order('created_at', { ascending: true });
    setEvents(data || []);
  };

  // Manager only — update any field
  const updateField = async (field, value) => {
    if (!canManageIncidents) { toast.error('You don\'t have permission to change this'); return; }
    const before = { [field]: incident[field] };
    const { error } = await supabase.from('incidents').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Update failed'); return; }
    setIncident(prev => ({ ...prev, [field]: value }));
    await supabase.from('incident_events').insert({
      incident_id: id, actor_id: user.id, event_type: 'status_change',
      description: `${field} changed to ${value} by manager`
    });
    await logAudit({ venueId: venue.id, actorId: user.id, actorRole: profile.role, action: `incident_${field}_update`, resourceType: 'incident', resourceId: id, beforeState: before, afterState: { [field]: value } });
    toast.success('Updated');
  };

  // Manager only — assign staff (auto-triggers status → 'assigned' via DB trigger)
  const handleAssign = async (staffProfileId) => {
    if (!canManageIncidents) return;
    const val = staffProfileId || null;
    const { error } = await supabase.from('incidents')
      .update({ assigned_to: val, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Assignment failed'); return; }
    setIncident(prev => ({ ...prev, assigned_to: val, status: val ? 'assigned' : 'open' }));
    await supabase.from('incident_events').insert({
      incident_id: id, actor_id: user.id, event_type: 'assigned',
      description: val ? `Assigned to staff member` : 'Unassigned — status reset to open'
    });
    toast.success(val ? 'Assigned! Status auto-set to Assigned.' : 'Unassigned. Status reset to Open.');
  };

  // Manager only — close incident (requires resolved state, or force-close with confirm)
  const handleClose = async () => {
    if (!canManageIncidents) return;
    // If awaiting guest confirm, prompt
    if (!incident.confirmed_resolved_by_guest) {
      if (!window.confirm('Guest has not confirmed resolution yet. Force-close this incident anyway?')) return;
    }
    const { error } = await supabase.from('incidents')
      .update({ status: 'closed', closed_by: user.id, closed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Close failed'); return; }
    setIncident(prev => ({ ...prev, status: 'closed' }));
    await supabase.from('incident_events').insert({
      incident_id: id, actor_id: user.id, event_type: 'closed',
      description: incident.confirmed_resolved_by_guest
        ? 'Manager closed incident after guest confirmation'
        : 'Manager force-closed incident'
    });
    toast.success('Incident closed!');
  };

  // Manager only — delete incident
  const handleDelete = async () => {
    if (!canDeleteIncidents) return;
    if (!window.confirm('Permanently delete this incident? This cannot be undone.')) return;
    const { error } = await supabase.from('incidents').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Incident deleted');
    navigate('/venue/incidents');
  };

  const regenerateBriefing = async () => {
    setAiLoading(true);
    try {
      const briefing = await generateBriefing(incident);
      await supabase.from('incidents').update({ ai_briefing: briefing }).eq('id', id);
      setIncident(prev => ({ ...prev, ai_briefing: briefing }));
      toast.success('Briefing regenerated');
    } catch { toast.error('AI briefing failed'); }
    finally { setAiLoading(false); }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const { data: msgs } = await supabase.from('incident_messages').select('*').eq('incident_id', id).order('created_at');
      const report = await generateIncidentReport(incident, events, msgs || []);
      await supabase.from('incidents').update({ ai_report: report }).eq('id', id);
      setIncident(prev => ({ ...prev, ai_report: report }));
      toast.success('Report generated');
    } catch { toast.error('Report generation failed'); }
    finally { setReportLoading(false); }
  };

  const downloadReport = () => {
    if (!incident?.ai_report) return;
    const blob = new Blob([incident.ai_report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `incident-report-${id}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Spinner className="py-16" size="lg" />;
  if (!incident) return <p className="text-center py-16 text-haven-muted">Incident not found</p>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/venue/incidents')} className="flex items-center gap-2 text-haven-muted text-sm hover:text-haven-dark">
        <ArrowLeft className="w-4 h-4" /> Back to Incidents
      </button>

      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-haven-dark">{incident.title}</h1>
          <p className="text-sm text-haven-muted mt-1">{incident.description}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Badge variant={incident.severity}>{incident.severity}</Badge>
          <Badge variant={incident.status}>{incident.status?.replace(/_/g, ' ')}</Badge>
          {incident.confirmed_resolved_by_guest && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ Guest Confirmed</span>
          )}
          {canDeleteIncidents && incident.status !== 'closed' && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 text-haven-muted hover:text-red-500 transition-colors"
              title="Delete incident"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Close banner — shown when resolved (with or without guest confirmation) */}
      {canManageIncidents && incident.status === 'resolved' && (
        <div className={`card p-4 flex items-center justify-between ${incident.confirmed_resolved_by_guest ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <div>
            {incident.confirmed_resolved_by_guest ? (
              <>
                <p className="text-sm font-semibold text-green-800">✅ Guest confirmed — ready to close</p>
                <p className="text-xs text-green-600 mt-0.5">You can now permanently close this incident.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-800">⏳ Awaiting guest confirmation</p>
                <p className="text-xs text-amber-600 mt-0.5">Guest has been notified. You can also force-close.</p>
              </>
            )}
          </div>
          <Button onClick={handleClose} className={`text-sm ${incident.confirmed_resolved_by_guest ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'} text-white`}>
            Close Incident
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel */}
        <div className="space-y-4">
          {/* Manager controls only */}
          {canManageIncidents ? (
            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-haven-muted uppercase tracking-wider">Manager Controls</p>
              <div>
                <label className="label-caption block mb-1">Status</label>
                <select value={incident.status} onChange={(e) => updateField('status', e.target.value)} className="input-field">
                  <option value="open">Open</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="escalated">Escalated</option>
                  {/* resolved / closed only set by system — not manually */}
                  {incident.status === 'resolved' && <option value="resolved" disabled>Resolved (awaiting close)</option>}
                  {incident.status === 'closed' && <option value="closed" disabled>Closed</option>}
                </select>
              </div>
              <div>
                <label className="label-caption block mb-1">Severity</label>
                <select value={incident.severity} onChange={(e) => updateField('severity', e.target.value)} className="input-field">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="label-caption block mb-1">Assign To (auto-sets status)</label>
                <select value={incident.assigned_to || ''} onChange={(e) => handleAssign(e.target.value || null)} className="input-field">
                  <option value="">Unassigned</option>
                  {staff.map(s => (
                    <option key={s.profile_id} value={s.profile_id}>{s.profile?.full_name || 'Staff'}</option>
                  ))}
                </select>
                <p className="text-xs text-haven-muted mt-1">
                  Assigning → status becomes "Assigned". Removing → status reverts to "Open".
                </p>
              </div>
            </div>
          ) : (
            <div className="card p-4 flex items-center gap-3 text-haven-muted bg-gray-50">
              <Lock className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-haven-dark">Read-Only View</p>
                <p className="text-xs">Only managers can modify incidents. Mark as resolved from <strong>My Tasks</strong>.</p>
              </div>
            </div>
          )}

          {/* AI Briefing */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><Bot className="w-4 h-4 text-purple-600" /><span className="font-semibold text-sm text-haven-dark">AI Briefing</span></div>
              {canManageIncidents && <Button variant="ghost" onClick={regenerateBriefing} loading={aiLoading} className="text-xs"><RefreshCw className="w-3.5 h-3.5" /> Regenerate</Button>}
            </div>
            <p className="text-sm text-haven-muted leading-relaxed">{incident.ai_briefing || 'No AI briefing generated yet.'}</p>
          </div>

          {/* Report — manager only */}
          {canManageIncidents && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-haven-dark">Incident Report</span>
                <div className="flex gap-2">
                  {incident.ai_report && <Button variant="ghost" onClick={downloadReport} className="text-xs"><Download className="w-3.5 h-3.5" /> Download</Button>}
                  <Button variant="secondary" onClick={handleGenerateReport} loading={reportLoading} className="text-xs">Generate Report</Button>
                </div>
              </div>
              {incident.ai_report ? <pre className="text-xs text-haven-muted whitespace-pre-wrap max-h-48 overflow-y-auto">{incident.ai_report}</pre> : <p className="text-sm text-haven-muted">No report generated yet.</p>}
            </div>
          )}

          {/* Audit trail */}
          <div className="card p-4">
            <h3 className="font-semibold text-sm text-haven-dark mb-3">Audit Trail</h3>
            <AuditTrail events={events} />
          </div>
        </div>

        {/* Right panel - Chat */}
        <div className="card overflow-hidden" style={{ minHeight: '500px' }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-haven-dark">Live Chat</h3>
          </div>
          <IncidentChat incidentId={id} isStaff={true} />
        </div>
      </div>
    </div>
  );
}
