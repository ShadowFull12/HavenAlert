import React, { useState } from 'react';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function GuestProfile() {
  const { profile, refreshProfile } = useAuthStore();
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    language_preference: profile?.language_preference || 'en',
    allergies: profile?.medical_profile?.allergies || '',
    conditions: profile?.medical_profile?.conditions || '',
    medications: profile?.medical_profile?.medications || '',
    blood_type: profile?.medical_profile?.blood_type || '',
    emergency_contact: profile?.medical_profile?.emergency_contact || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name,
        phone: form.phone,
        language_preference: form.language_preference,
        medical_profile: {
          allergies: form.allergies,
          conditions: form.conditions,
          medications: form.medications,
          blood_type: form.blood_type,
          emergency_contact: form.emergency_contact,
        },
      }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-haven-dark">My Profile</h2>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-haven-dark text-sm">Personal Info</h3>
          <Input label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div>
            <label className="label-caption block mb-1.5">Language</label>
            <select value={form.language_preference} onChange={(e) => setForm({ ...form, language_preference: e.target.value })} className="input-field">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="hi">Hindi</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-haven-dark text-sm">Medical Profile</h3>
          <p className="text-xs text-haven-muted">This info helps staff respond to medical emergencies. It's private and only shared during an incident.</p>
          <Input label="Allergies" placeholder="e.g., penicillin, peanuts" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
          <Input label="Medical Conditions" placeholder="e.g., asthma, diabetes" value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} />
          <Input label="Medications" placeholder="Current medications" value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} />
          <Input label="Blood Type" placeholder="e.g., O+" value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })} />
          <Input label="Emergency Contact" placeholder="Name & phone number" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
        </div>

        <Button type="submit" loading={loading} className="w-full">Save Profile</Button>
      </form>
    </div>
  );
}
