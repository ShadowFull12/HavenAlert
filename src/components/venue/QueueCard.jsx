import React from 'react';
import { User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Button from '../ui/Button';

export default function QueueCard({ queueItem, onAssign }) {
  return (
    <div className="card p-4 animate-slide-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-info-light flex items-center justify-center">
            <User className="w-5 h-5 text-info" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-haven-dark">
              {queueItem.guest?.full_name || 'Guest'}
            </h4>
            <div className="flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-haven-muted" />
              <span className="text-xs text-haven-muted">
                {queueItem.requested_at
                  ? formatDistanceToNow(new Date(queueItem.requested_at), { addSuffix: true })
                  : 'Just now'}
              </span>
            </div>
          </div>
        </div>
        <Button variant="primary" onClick={() => onAssign(queueItem)} className="text-xs px-3 py-1.5">
          Assign Room
        </Button>
      </div>
      {queueItem.notes && (
        <p className="text-xs text-haven-muted mt-2 pl-13">{queueItem.notes}</p>
      )}
    </div>
  );
}
