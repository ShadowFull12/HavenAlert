import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Flame, Shield, Wrench, Volume2, Package, HelpCircle, Stethoscope } from 'lucide-react';
import Badge from '../ui/Badge';

const typeIcons = {
  medical: Stethoscope,
  fire: Flame,
  security: Shield,
  maintenance: Wrench,
  noise: Volume2,
  theft: Package,
  other: HelpCircle,
};

export default function IncidentCard({ incident, onClick }) {
  const Icon = typeIcons[incident.type] || AlertTriangle;
  const timeAgo = incident.created_at
    ? formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })
    : '';

  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:shadow-md transition-shadow duration-150 animate-slide-in"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          incident.severity === 'critical' ? 'bg-danger-light' :
          incident.severity === 'high' ? 'bg-warning-light' :
          incident.severity === 'medium' ? 'bg-info-light' : 'bg-gray-100'
        }`}>
          <Icon className={`w-5 h-5 ${
            incident.severity === 'critical' ? 'text-danger' :
            incident.severity === 'high' ? 'text-warning' :
            incident.severity === 'medium' ? 'text-info' : 'text-haven-muted'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm text-haven-dark truncate">{incident.title}</h4>
            <Badge variant={incident.severity}>{incident.severity}</Badge>
            <Badge variant={incident.status}>{incident.status?.replace('_', ' ')}</Badge>
          </div>

          <p className="text-xs text-haven-muted mt-1 truncate">
            {incident.reported_by_profile?.full_name || 'Guest'} • {timeAgo}
          </p>

          {incident.assigned_to_profile?.full_name && (
            <p className="text-xs text-info mt-0.5">
              Assigned to {incident.assigned_to_profile.full_name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
