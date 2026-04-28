import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useVenueStore from '../../store/venueStore';
import { useRealtimeIncidents } from '../../hooks/useRealtimeIncidents';
import IncidentCard from '../../components/incidents/IncidentCard';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { AlertTriangle } from 'lucide-react';

const TABS = ['all', 'open', 'in_progress', 'resolved'];

export default function IncidentBoard() {
  const { venue } = useVenueStore();
  const navigate = useNavigate();
  const { incidents, loading } = useRealtimeIncidents(venue?.id);
  const [activeTab, setActiveTab] = useState('all');

  const filtered = activeTab === 'all'
    ? incidents
    : incidents.filter(i => i.status === activeTab);

  // Sort by severity (critical first) then by date
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...filtered].sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (loading) return <Spinner className="py-16" size="lg" />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-haven-dark">Incidents</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-all duration-150 min-h-[36px] ${
              activeTab === tab
                ? 'bg-white text-haven-dark shadow-sm'
                : 'text-haven-muted hover:text-haven-dark'
            }`}
          >
            {tab.replace('_', ' ')}
            {tab !== 'all' && (
              <span className="ml-1.5 text-xs opacity-60">
                {incidents.filter(i => i.status === tab).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Incident list */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No incidents"
          message={activeTab === 'all' ? 'No incidents have been reported yet.' : `No ${activeTab.replace('_', ' ')} incidents.`}
        />
      ) : (
        <div className="space-y-2">
          {sorted.map(incident => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onClick={() => navigate(`/venue/incidents/${incident.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
