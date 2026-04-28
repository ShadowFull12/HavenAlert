import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Users, DoorOpen, MessageSquare, Shield } from 'lucide-react';
import useVenueStore from '../../store/venueStore';
import { supabase } from '../../lib/supabase';
import { useRealtimeIncidents } from '../../hooks/useRealtimeIncidents';
import IncidentCard from '../../components/incidents/IncidentCard';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';

export default function VenueDashboard() {
  const { venue } = useVenueStore();
  const navigate = useNavigate();
  const { incidents, loading } = useRealtimeIncidents(venue?.id);
  const [stats, setStats] = useState({ guests: 0, queue: 0, complaints: 0 });

  useEffect(() => {
    if (!venue?.id) return;
    loadStats();
  }, [venue]);

  const loadStats = async () => {
    const [rooms, queue, complaints] = await Promise.all([
      supabase.from('rooms').select('id', { count: 'exact' }).eq('venue_id', venue.id).eq('status', 'occupied'),
      supabase.from('guest_queue').select('id', { count: 'exact' }).eq('venue_id', venue.id).eq('status', 'pending'),
      supabase.from('complaints').select('id', { count: 'exact' }).eq('venue_id', venue.id).eq('status', 'open'),
    ]);
    setStats({
      guests: rooms.count || 0,
      queue: queue.count || 0,
      complaints: complaints.count || 0,
    });
  };

  const activeIncidents = incidents.filter(i => !['resolved', 'closed'].includes(i.status));
  const criticalCount = activeIncidents.filter(i => i.severity === 'critical').length;
  const highCount = activeIncidents.filter(i => i.severity === 'high').length;
  const riskLevel = criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : 'low';

  const summaryCards = [
    { label: 'Active Incidents', value: activeIncidents.length, icon: AlertTriangle, color: 'text-danger bg-danger-light', onClick: () => navigate('/venue/incidents') },
    { label: 'Guests in Rooms', value: stats.guests, icon: Users, color: 'text-info bg-info-light', onClick: () => navigate('/venue/rooms') },
    { label: 'Pending Queue', value: stats.queue, icon: DoorOpen, color: 'text-warning bg-warning-light', onClick: () => navigate('/venue/queue') },
    { label: 'Open Complaints', value: stats.complaints, icon: MessageSquare, color: 'text-purple-600 bg-purple-100', onClick: () => navigate('/venue/complaints') },
  ];

  if (loading) return <Spinner className="py-16" size="lg" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-haven-dark">Dashboard</h1>
          <p className="text-sm text-haven-muted">{venue?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-haven-muted">Risk Level</span>
          <Badge variant={riskLevel}>
            {riskLevel === 'critical' ? '🔴 Critical' : riskLevel === 'high' ? '🟠 Elevated' : '🟢 Normal'}
          </Badge>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map(({ label, value, icon: Icon, color, onClick }) => (
          <button key={label} onClick={onClick} className="card p-4 text-left hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-haven-dark">{value}</p>
            <p className="text-xs text-haven-muted mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Recent incidents */}
      <div>
        <h3 className="font-semibold text-haven-dark mb-3">Recent Incidents</h3>
        {incidents.length === 0 ? (
          <div className="card p-8 text-center">
            <Shield className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="text-sm text-haven-muted">No incidents reported. All clear!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.slice(0, 5).map(incident => (
              <IncidentCard key={incident.id} incident={incident} onClick={() => navigate(`/venue/incidents/${incident.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
