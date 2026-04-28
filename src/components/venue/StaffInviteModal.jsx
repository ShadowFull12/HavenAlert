import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import useVenueStore from '../../store/venueStore';
import useAuthStore from '../../store/authStore';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';

export default function StaffInviteModal({ isOpen, onClose }) {
  const { venue } = useVenueStore();
  const { user } = useAuthStore();
  const [role, setRole] = useState('staff');
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_invites')
        .insert({
          venue_id: venue.id,
          role,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      setGeneratedCode(data.code);
      toast.success('Invite code generated!');
    } catch (err) {
      console.error('Generate invite error:', err);
      toast.error('Failed to generate invite code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (generatedCode) {
      await navigator.clipboard.writeText(generatedCode);
      toast.success('Code copied!');
    }
  };

  const handleClose = () => {
    setGeneratedCode(null);
    setRole('staff');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Generate Staff Invite">
      {generatedCode ? (
        <div className="text-center py-4">
          <p className="text-sm text-haven-muted mb-4">Share this code with your new staff member</p>
          <div className="bg-gray-50 rounded-xl px-6 py-4 mb-4 inline-block">
            <span className="text-2xl font-bold tracking-widest font-mono text-haven-dark">
              {generatedCode}
            </span>
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={handleCopy}>Copy Code</Button>
            <Button variant="secondary" onClick={handleClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="label-caption block mb-1.5">Staff Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="input-field"
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <Button onClick={handleGenerate} loading={loading} className="w-full">
            Generate Invite Code
          </Button>
        </div>
      )}
    </Modal>
  );
}
