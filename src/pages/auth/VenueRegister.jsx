import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ArrowLeft, CheckCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useVenueStore from '../../store/venueStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function VenueRegister() {
  const navigate = useNavigate();
  const { signUp } = useAuthStore();
  const { createVenue } = useVenueStore();
  const [step, setStep] = useState(1);
  const [emailConfirmNeeded, setEmailConfirmNeeded] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', password: '',
    venueName: '', venueType: 'hotel', address: '', city: '', country: '', phone: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateStep1 = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email format';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Minimum 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.venueName.trim()) e.venueName = 'Venue name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) {
      if (validateStep1()) setStep(2);
      return;
    }

    if (!validateStep2()) return;

    setLoading(true);
    try {
      const { data, error: authError } = await signUp(form.email, form.password, form.fullName, 'owner');
      if (authError) throw authError;

      // Check if email confirmation is needed (user.session will be null if so)
      if (!data?.session) {
        // Email confirmation required — save form and show a message
        setEmailConfirmNeeded(true);
        toast('Please check your email to confirm your account, then come back to log in.', { icon: '📧', duration: 6000 });
        return;
      }

      // Session exists — we can proceed to create the venue immediately
      const { error: venueError } = await createVenue({
        name: form.venueName,
        type: form.venueType,
        address: form.address,
        city: form.city,
        country: form.country,
        phone: form.phone,
      }, data.user.id);

      if (venueError) throw venueError;

      toast.success('Venue created! Welcome to HavenAlert.');
      navigate('/venue');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // If email confirmation is required, show a friendly message
  if (emailConfirmNeeded) {
    return (
      <div className="min-h-screen bg-haven-light flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-haven-dark mb-3">Check Your Email</h1>
          <p className="text-haven-muted text-sm mb-8">
            We sent a confirmation link to <strong>{form.email}</strong>. 
            Click it to activate your account, then sign in below to complete your venue setup.
          </p>
          <Button className="w-full" onClick={() => navigate('/auth/venue-login')}>
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-haven-light flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <button onClick={() => step === 1 ? navigate('/') : setStep(1)} className="flex items-center gap-2 text-haven-muted text-sm mb-8 hover:text-haven-dark transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? 'Back' : 'Previous step'}
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-haven-dark flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-haven-dark">Venue Registration</h1>
            <p className="text-sm text-haven-muted">Step {step} of 2</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-haven-dark' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-haven-dark' : 'bg-gray-200'}`} />
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {step === 1 ? (
            <>
              <Input label="Your Full Name" placeholder="Jane Doe" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} error={errors.fullName} />
              <Input label="Email" type="email" placeholder="jane@venue.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
              <Input label="Password" type="password" placeholder="Minimum 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} />
              <Button type="submit" className="w-full">Continue</Button>
            </>
          ) : (
            <>
              <Input label="Venue Name" placeholder="Grand Hotel" value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} error={errors.venueName} />
              <div>
                <label className="label-caption block mb-1.5">Venue Type</label>
                <select value={form.venueType} onChange={(e) => setForm({ ...form, venueType: e.target.value })} className="input-field">
                  <option value="hotel">Hotel</option>
                  <option value="resort">Resort</option>
                  <option value="hostel">Hostel</option>
                  <option value="event_space">Event Space</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <Input label="Address" placeholder="123 Main Street" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Input label="Country" placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <Input label="Phone" placeholder="+1 234 567 8900" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Button type="submit" loading={loading} className="w-full">Create Venue</Button>
            </>
          )}
        </form>

        <p className="text-center text-sm text-haven-muted mt-6">
          Already registered?{' '}
          <Link to="/auth/venue-login" className="text-haven-dark font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
