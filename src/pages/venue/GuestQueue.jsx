import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import useVenueStore from '../../store/venueStore';
import useAuthStore from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import QueueCard from '../../components/venue/QueueCard';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function GuestQueue() {
  const { venue } = useVenueStore();
  const { user, profile } = useAuthStore();
  const { can } = usePermissions();
  const canManageGuests = can('manage_guests');
  const { queue, loading } = useRealtimeQueue(venue?.id);
  const [rooms, setRooms] = useState([]);
  const [assignModal, setAssignModal] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!venue?.id) return;
    fetchRooms();
  }, [venue]);

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('venue_id', venue.id).eq('status', 'available').order('room_number');
    setRooms(data || []);
  };

  const handleAssign = async () => {
    if (!selectedRoom || !assignModal) return;
    setAssigning(true);
    try {
      // Update room
      await supabase.from('rooms').update({ current_guest_id: assignModal.guest_id, status: 'occupied' }).eq('id', selectedRoom);
      // Update guest profile
      await supabase.from('profiles').update({ venue_id: venue.id, room_id: selectedRoom }).eq('id', assignModal.guest_id);
      // Update queue
      await supabase.from('guest_queue').update({ status: 'processed', processed_at: new Date().toISOString(), processed_by: user.id }).eq('id', assignModal.id);
      // Audit
      await logAudit({ venueId: venue.id, actorId: user.id, actorRole: profile.role, action: 'guest_room_assigned', resourceType: 'room', resourceId: selectedRoom, afterState: { guest_id: assignModal.guest_id } });

      toast.success('Guest assigned to room!');
      setAssignModal(null);
      setSelectedRoom('');
      fetchRooms();
    } catch (err) {
      toast.error(err.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <Spinner className="py-16" size="lg" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-haven-dark">Guest Queue</h1>
        <p className="text-sm text-haven-muted">{queue.length} guest{queue.length !== 1 ? 's' : ''} waiting</p>
      </div>

      {queue.length === 0 ? (
        <EmptyState icon={Users} title="Queue is empty" message="No guests are waiting for room assignment." />
      ) : (
        <div className="space-y-2">
          {queue.map(item => (
            <QueueCard key={item.id} queueItem={item} onAssign={canManageGuests ? setAssignModal : undefined} />
          ))}
        </div>
      )}

      <Modal isOpen={!!assignModal} onClose={() => { setAssignModal(null); setSelectedRoom(''); }} title="Assign Room">
        <div className="space-y-4">
          <p className="text-sm text-haven-muted">
            Assign <strong>{assignModal?.guest?.full_name || 'Guest'}</strong> to a room:
          </p>
          {rooms.length === 0 ? (
            <p className="text-sm text-danger">No available rooms. Add rooms in Room Manager first.</p>
          ) : (
            <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="input-field">
              <option value="">Select a room</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>Room {r.room_number} ({r.room_type})</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <Button onClick={handleAssign} loading={assigning} disabled={!selectedRoom} className="flex-1">Assign</Button>
            <Button variant="secondary" onClick={() => setAssignModal(null)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
