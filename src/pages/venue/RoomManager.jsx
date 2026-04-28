import React, { useState, useEffect } from 'react';
import { Plus, DoorOpen, Layers } from 'lucide-react';
import useVenueStore from '../../store/venueStore';
import useAuthStore from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import RoomCard from '../../components/venue/RoomCard';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

export default function RoomManager() {
  const { venue } = useVenueStore();
  const { user, profile } = useAuthStore();
  const { can } = usePermissions();
  const canManageRooms = can('manage_rooms');
  const canManageGuests = can('manage_guests');
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFloor, setActiveFloor] = useState(null);
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showRoomDetail, setShowRoomDetail] = useState(null);
  const [floorForm, setFloorForm] = useState({ name: '', floor_number: '' });
  const [roomForm, setRoomForm] = useState({ room_number: '', room_type: 'standard', capacity: 2 });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (venue?.id) fetchAll(); }, [venue]);

  const fetchAll = async () => {
    const [fRes, rRes] = await Promise.all([
      supabase.from('floors').select('*').eq('venue_id', venue.id).order('floor_number'),
      supabase.from('rooms').select('*').eq('venue_id', venue.id).order('room_number'),
    ]);
    setFloors(fRes.data || []);
    setRooms(rRes.data || []);
    if (fRes.data?.length && !activeFloor) setActiveFloor(fRes.data[0].id);
    setLoading(false);
  };

  const addFloor = async (e) => {
    e.preventDefault();
    if (!floorForm.name.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('floors').insert({ venue_id: venue.id, name: floorForm.name, floor_number: parseInt(floorForm.floor_number) || 0 });
      if (error) throw error;
      setFloorForm({ name: '', floor_number: '' });
      setShowAddFloor(false);
      fetchAll();
      toast.success('Floor added');
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const addRoom = async (e) => {
    e.preventDefault();
    if (!roomForm.room_number.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('rooms').insert({ venue_id: venue.id, floor_id: activeFloor, room_number: roomForm.room_number, room_type: roomForm.room_type, capacity: parseInt(roomForm.capacity) || 2 });
      if (error) throw error;
      setRoomForm({ room_number: '', room_type: 'standard', capacity: 2 });
      setShowAddRoom(false);
      fetchAll();
      toast.success('Room added');
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const checkoutGuest = async (room) => {
    if (!confirm('Check out guest from this room?')) return;
    try {
      await supabase.from('profiles').update({ room_id: null }).eq('id', room.current_guest_id);
      await supabase.from('rooms').update({ current_guest_id: null, status: 'available' }).eq('id', room.id);
      await logAudit({ venueId: venue.id, actorId: user.id, actorRole: profile.role, action: 'guest_checkout', resourceType: 'room', resourceId: room.id });
      fetchAll();
      setShowRoomDetail(null);
      toast.success('Guest checked out');
    } catch (err) { toast.error(err.message); }
  };

  const floorRooms = rooms.filter(r => r.floor_id === activeFloor);

  if (loading) return <Spinner className="py-16" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-haven-dark">Rooms</h1>
        {canManageRooms && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowAddFloor(true)} className="text-sm"><Layers className="w-4 h-4" /> Add Floor</Button>
            <Button onClick={() => setShowAddRoom(true)} disabled={!activeFloor} className="text-sm"><Plus className="w-4 h-4" /> Add Room</Button>
          </div>
        )}
      </div>

      {/* Floor tabs */}
      {floors.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {floors.map(f => (
            <button key={f.id} onClick={() => setActiveFloor(f.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all min-h-[36px] ${activeFloor === f.id ? 'bg-haven-dark text-white' : 'bg-gray-100 text-haven-muted hover:bg-gray-200'}`}>
              {f.name}
            </button>
          ))}
        </div>
      )}

      {floors.length === 0 ? (
        <EmptyState icon={Layers} title="No floors yet" message="Add a floor to start managing rooms." action="Add Floor" onAction={() => setShowAddFloor(true)} />
      ) : floorRooms.length === 0 ? (
        <EmptyState icon={DoorOpen} title="No rooms on this floor" message="Add rooms to this floor." action="Add Room" onAction={() => setShowAddRoom(true)} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {floorRooms.map(room => (
            <RoomCard key={room.id} room={room} onClick={() => setShowRoomDetail(room)} />
          ))}
        </div>
      )}

      {/* Add Floor Modal */}
      <Modal isOpen={showAddFloor} onClose={() => setShowAddFloor(false)} title="Add Floor">
        <form onSubmit={addFloor} className="space-y-4">
          <Input label="Floor Name" placeholder="e.g., Ground Floor" value={floorForm.name} onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })} />
          <Input label="Floor Number" type="number" placeholder="0" value={floorForm.floor_number} onChange={(e) => setFloorForm({ ...floorForm, floor_number: e.target.value })} />
          <Button type="submit" loading={submitting} className="w-full">Add Floor</Button>
        </form>
      </Modal>

      {/* Add Room Modal */}
      <Modal isOpen={showAddRoom} onClose={() => setShowAddRoom(false)} title="Add Room">
        <form onSubmit={addRoom} className="space-y-4">
          <Input label="Room Number" placeholder="101" value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} />
          <div>
            <label className="label-caption block mb-1.5">Room Type</label>
            <select value={roomForm.room_type} onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })} className="input-field">
              <option value="standard">Standard</option>
              <option value="deluxe">Deluxe</option>
              <option value="suite">Suite</option>
              <option value="penthouse">Penthouse</option>
            </select>
          </div>
          <Input label="Capacity" type="number" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} />
          <Button type="submit" loading={submitting} className="w-full">Add Room</Button>
        </form>
      </Modal>

      {/* Room Detail Modal */}
      <Modal isOpen={!!showRoomDetail} onClose={() => setShowRoomDetail(null)} title={`Room ${showRoomDetail?.room_number || ''}`}>
        {showRoomDetail && (
          <div className="space-y-3">
            <p className="text-sm"><strong>Type:</strong> {showRoomDetail.room_type}</p>
            <p className="text-sm"><strong>Status:</strong> {showRoomDetail.status}</p>
            <p className="text-sm"><strong>Capacity:</strong> {showRoomDetail.capacity}</p>
            {showRoomDetail.current_guest_id && canManageGuests && (
              <Button variant="danger" onClick={() => checkoutGuest(showRoomDetail)} className="w-full">Check Out Guest</Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
