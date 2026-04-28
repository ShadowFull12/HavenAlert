import React from 'react';
import { format } from 'date-fns';
import { Clock, User, AlertTriangle, CheckCircle, ArrowRight, MessageSquare, Bot } from 'lucide-react';

const eventIcons = {
  created: AlertTriangle,
  assigned: ArrowRight,
  status_change: ArrowRight,
  message: MessageSquare,
  ai_briefing: Bot,
  resolved: CheckCircle,
  default: Clock,
};

const eventColors = {
  created: 'text-danger bg-danger-light',
  assigned: 'text-info bg-info-light',
  status_change: 'text-warning bg-warning-light',
  message: 'text-haven-muted bg-gray-100',
  ai_briefing: 'text-purple-600 bg-purple-100',
  resolved: 'text-success bg-success-light',
  default: 'text-haven-muted bg-gray-100',
};

export default function AuditTrail({ events = [] }) {
  if (events.length === 0) {
    return <p className="text-sm text-haven-muted text-center py-6">No events recorded yet</p>;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

      <div className="space-y-4">
        {events.map((event) => {
          const Icon = eventIcons[event.event_type] || eventIcons.default;
          const colorClass = eventColors[event.event_type] || eventColors.default;

          return (
            <div key={event.id} className="relative flex items-start gap-4 pl-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${colorClass}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <p className="text-sm text-haven-dark font-medium">{event.description}</p>
                <p className="text-xs text-haven-muted mt-0.5">
                  {event.created_at ? format(new Date(event.created_at), 'MMM d, HH:mm') : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
