import React, { useState } from 'react';
import useVenueStore from '../../store/venueStore';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import VenueCodeCard from '../../components/venue/VenueCodeCard';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function VenueSettings() {
  const { venue } = useVenueStore();
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    name: venue?.name || '',
    address: venue?.address || '',
    city: venue?.city || '',
    country: venue?.country || '',
    phone: venue?.phone || '',
    email: venue?.email || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('venues').update({ ...form, updated_at: new Date().toISOString() }).eq('id', venue.id);
      if (error) throw error;
      toast.success('Venue updated');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const regenerateCode = async () => {
    if (!confirm('Regenerate venue code? Existing guests will need the new code.')) return;
    try {
      const newCode = Array.from({ length: 8 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');
      const { error } = await supabase.from('venues').update({ venue_code: newCode }).eq('id', venue.id);
      if (error) throw error;
      toast.success('Venue code regenerated!');
      window.location.reload();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-haven-dark">Venue Settings</h1>

      <VenueCodeCard venueCode={venue?.venue_code || '--------'} />

      <Button variant="secondary" onClick={regenerateCode} className="text-sm">Regenerate Venue Code</Button>

      <form onSubmit={handleSave} className="card p-5 space-y-4">
        <h3 className="font-semibold text-haven-dark text-sm">Venue Profile</h3>
        <Input label="Venue Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </div>
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Button type="submit" loading={saving} className="w-full">Save Changes</Button>
      </form>
    </div>
  );
}
