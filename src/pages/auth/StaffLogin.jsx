import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, ArrowLeft, UserPlus } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useVenueStore from '../../store/venueStore';
import { supabase } from '../../lib/supabase';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function StaffLogin() {
  const navigate = useNavigate();
  const { signIn, user, profile, refreshProfile } = useAuthStore();
  const { loadVenueForUser, venue } = useVenueStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Reactive redirect — as soon as user + venue are both loaded, go to dashboard
  useEffect(() => {
    if (user && profile && venue) {
      navigate('/venue', { replace: true });
    }
  }, [user, profile, venue]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.email.trim()) errs.email = 'Required';
    if (!form.password) errs.password = 'Required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const { data, error } = await signIn(form.email, form.password);
      if (error) throw error;

      // signIn() already fetches and sets profile in the store — read it fresh
      const freshProfile = useAuthStore.getState().profile;

      // Load venue using unified strategy (works for staff, manager, owner)
      const result = await loadVenueForUser(freshProfile);

      if (!result) {
        // No venue found — show invite flow
        setShowInvite(true);
        setLoading(false);
        return;
      }

      toast.success('Welcome back!');
      // navigate handled by useEffect when venue state is set
    } catch (err) {
      toast.error(err.message || 'Invalid credentials. Check your email and password.');
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) { setErrors({ invite: 'Enter invite code' }); return; }
    setLoading(true);
    try {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) throw new Error('Please sign in first');

      const { data: invite, error } = await supabase
        .from('staff_invites')
        .select('*')
        .eq('code', inviteCode.trim().toUpperCase())
        .is('used_by', null)
        .gt('expires_at', new Date().toISOString())
        .single();
      if (error || !invite) throw new Error('Invalid or expired invite code');

      // Check not already a member
      const { data: existing } = await supabase
        .from('staff_members')
        .select('id')
        .eq('venue_id', invite.venue_id)
        .eq('profile_id', currentUser.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('staff_members').insert({
          venue_id: invite.venue_id,
          profile_id: currentUser.id,
          role: invite.role,
          group_id: invite.group_id || null,
          is_active: true,
        });
      }

      await supabase.from('staff_invites').update({
        used_by: currentUser.id, used_at: new Date().toISOString()
      }).eq('id', invite.id);

      await supabase.from('profiles').update({
        role: invite.role, venue_id: invite.venue_id
      }).eq('id', currentUser.id);

      await refreshProfile();
      // Use the FRESH profile, not stale closure value
      const freshProfile = useAuthStore.getState().profile;
      await loadVenueForUser(freshProfile);
      toast.success('🎉 Welcome to the team!');
      navigate('/venue', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-haven-light flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-haven-muted text-sm mb-8 hover:text-haven-dark">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-haven-dark flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-haven-dark">Staff Login</h1>
            <p className="text-sm text-haven-muted">
              {showInvite ? 'Enter your invite code' : 'For staff and managers'}
            </p>
          </div>
        </div>

        {showInvite ? (
          <form onSubmit={handleInvite} className="card p-6 space-y-4">
            <p className="text-sm text-haven-muted">No venue linked to your account. Enter the invite code from your venue manager.</p>
            <Input
              label="Invite Code"
              placeholder="ABCDEF1234"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              error={errors.invite}
            />
            <Button type="submit" loading={loading} className="w-full">Join Venue</Button>
            <button type="button" onClick={() => setShowInvite(false)} className="text-sm text-haven-muted hover:text-haven-dark w-full text-center">
              ← Back to login
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="card p-6 space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={errors.email}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={errors.password}
            />
            <Button type="submit" loading={loading} className="w-full">Sign In</Button>

            {/* Test credentials hint */}
            <div className="text-xs text-haven-muted bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="font-medium text-haven-dark">Test credentials:</p>
              <p>Manager: manager@havenalert.com / Manager@123</p>
              <p>Staff: security@havenalert.com / Staff@123</p>
              <p>Staff: maintenance@havenalert.com / Staff@123</p>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-haven-muted mt-6">
          New staff member?{' '}
          <Link to="/auth/staff-register" className="text-haven-dark font-medium hover:underline inline-flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" /> Create account
          </Link>
          {' · '}
          Guest? <Link to="/auth/guest-login" className="text-haven-dark font-medium hover:underline">Guest login</Link>
        </p>
      </div>
    </div>
  );
}
