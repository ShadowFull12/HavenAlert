import React from 'react';
import { User, DoorOpen } from 'lucide-react';
import Badge from '../ui/Badge';

const statusColors = {
  available: 'bg-success-light border-success/30',
  occupied: 'bg-info-light border-info/30',
  maintenance: 'bg-warning-light border-warning/30',
  cleaning: 'bg-gray-100 border-gray-200',
};

export default function RoomCard({ room, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border-2 p-4 cursor-pointer transition-all duration-150 hover:shadow-md ${
        statusColors[room.status] || statusColors.available
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-haven-muted" />
          <span className="font-bold text-haven-dark">{room.room_number}</span>
        </div>
        <Badge variant={room.status === 'available' ? 'success' : room.status === 'occupied' ? 'info' : 'warning'}>
          {room.status}
        </Badge>
      </div>

      <p className="text-xs text-haven-muted capitalize mb-1">{room.room_type}</p>

      {room.current_guest_id && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-200/50">
          <User className="w-3.5 h-3.5 text-haven-muted" />
          <span className="text-xs text-haven-muted">Guest assigned</span>
        </div>
      )}
    </div>
  );
}
