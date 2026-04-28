import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useVenueStore from '../../store/venueStore';
import { supabase } from '../../lib/supabase';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const STEPS = ['Create Account', 'Join Venue'];

export default function StaffRegister() {
  const navigate = useNavigate();
  const { signUp, signIn, user, refreshProfile } = useAuthStore();
  const { loadVenueForUser } = useVenueStore();

  const [step, setStep] = useState(0); // 0 = account, 1 = invite
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    inviteCode: '',
  });
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── Step 1: Create account ─────────────────────────────────────────────────
  const validateAccount = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name required';
    if (!form.email.trim()) e.email = 'Email required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.password) e.password = 'Password required';
    else if (form.password.length < 8) e.password = 'Minimum 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!validateAccount()) return;
    setLoading(true);
    try {
      // Sign up with role = 'staff' initially (will update after invite redemption)
      const { error } = await signUp(form.email, form.password, form.fullName, 'staff');
      if (error) throw error;

      // Sign in immediately so we have the user object
      const { data: signInData, error: signInError } = await signIn(form.email, form.password);
      if (signInError) throw signInError;

      setRegisteredUser(useAuthStore.getState().user);
      setStep(1);
      toast.success('Account created! Now enter your invite code.');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Redeem invite code ─────────────────────────────────────────────
  const handleJoinVenue = async (e) => {
    e.preventDefault();
    const code = form.inviteCode.trim().toUpperCase();
    if (!code) { setErrors({ inviteCode: 'Enter your invite code' }); return; }

    setLoading(true);
    try {
      const currentUser = registeredUser || useAuthStore.getState().user;
      if (!currentUser) throw new Error('Not logged in — please sign in again');

      // Look up the invite
      const { data: invite, error: invErr } = await supabase
        .from('staff_invites')
        .select('*')
        .eq('code', code)
        .is('used_by', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (invErr || !invite) throw new Error('Invalid or expired invite code');

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

      // Mark invite used
      await supabase.from('staff_invites').update({
        used_by: currentUser.id,
        used_at: new Date().toISOString(),
      }).eq('id', invite.id);

      // Update profile with venue + role
      await supabase.from('profiles').update({
        role: invite.role,
        venue_id: invite.venue_id,
      }).eq('id', currentUser.id);

      // Refresh state and navigate
      await refreshProfile();
      const freshProfile = useAuthStore.getState().profile;
      await loadVenueForUser(freshProfile);

      toast.success('🎉 Welcome to the team! Redirecting...');
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
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-haven-muted text-sm mb-8 hover:text-haven-dark transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-haven-dark flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-haven-dark">Staff Registration</h1>
            <p className="text-sm text-haven-muted">Create your account and join a venue</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((label, idx) => {
            const done = idx < step;
            const active = idx === step;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done ? 'bg-green-500 border-green-500 text-white' :
                    active ? 'bg-haven-dark border-haven-dark text-white' :
                    'bg-white border-gray-200 text-gray-300'
                  }`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span className={`text-xs font-medium ${active ? 'text-haven-dark' : done ? 'text-green-600' : 'text-gray-300'}`}>
                    {label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded ${idx < step ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Step 0: Create account ── */}
        {step === 0 && (
          <form onSubmit={handleCreateAccount} className="card p-6 space-y-4">
            <Input
              label="Full Name"
              placeholder="John Smith"
              value={form.fullName}
              onChange={set('fullName')}
              error={errors.fullName}
            />
            <Input
              label="Email"
              type="email"
              placeholder="john@example.com"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={set('password')}
                error={errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-haven-muted hover:text-haven-dark"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button type="submit" loading={loading} className="w-full">
              Create Account & Continue
            </Button>
            <p className="text-xs text-center text-haven-muted">
              By registering you agree to the platform's terms of use.
            </p>
          </form>
        )}

        {/* ── Step 1: Enter invite code ── */}
        {step === 1 && (
          <form onSubmit={handleJoinVenue} className="card p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-sm font-medium text-blue-900 mb-0.5">Account created ✓</p>
              <p className="text-xs text-blue-700">
                Now enter the invite code from your venue manager to join their team.
              </p>
            </div>

            <div>
              <label className="label-caption block mb-1.5">Invite Code</label>
              <input
                value={form.inviteCode}
                onChange={set('inviteCode')}
                placeholder="e.g. AB12CD34EF"
                className="input-field font-mono text-center tracking-widest uppercase text-lg font-bold"
                maxLength={14}
                autoFocus
              />
              {errors.inviteCode && <p className="text-xs text-red-500 mt-1">{errors.inviteCode}</p>}
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Join Venue
            </Button>

            <p className="text-xs text-center text-haven-muted">
              Don't have a code yet? Ask your manager to generate one from the Staff Management page.
            </p>
          </form>
        )}

        <p className="text-center text-sm text-haven-muted mt-6">
          Already have an account?{' '}
          <Link to="/auth/staff-login" className="text-haven-dark font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
