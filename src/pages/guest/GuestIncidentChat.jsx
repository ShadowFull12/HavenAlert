import React from 'react';
import { useParams } from 'react-router-dom';
import IncidentChat from '../../components/incidents/IncidentChat';

export default function GuestIncidentChat() {
  const { id } = useParams();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-haven-dark">Incident Chat</h2>
        <p className="text-sm text-haven-muted">Staff will respond shortly</p>
      </div>
      <div className="card overflow-hidden">
        <IncidentChat incidentId={id} isStaff={false} />
      </div>
    </div>
  );
}
