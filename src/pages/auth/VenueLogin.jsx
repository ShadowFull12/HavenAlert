import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ArrowLeft } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useVenueStore from '../../store/venueStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function VenueLogin() {
  const navigate = useNavigate();
  const { signIn, user } = useAuthStore();
  const { venue, loadVenueForUser } = useVenueStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [readyToNavigate, setReadyToNavigate] = useState(false);

  // Auto-redirect once venue is loaded after login
  useEffect(() => {
    if (readyToNavigate && user && venue) {
      navigate('/venue', { replace: true });
    }
  }, [readyToNavigate, user, venue]);

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { data, error } = await signIn(form.email, form.password);
      if (error) throw error;

      const profile = useAuthStore.getState().profile;
      const v = await loadVenueForUser(profile);

      if (!v) {
        toast.error('No venue found. Please register a venue or contact your admin.');
        return;
      }

      toast.success('Welcome back!');
      setReadyToNavigate(true);
    } catch (err) {
      toast.error(err.message || 'Login failed');
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
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-haven-dark">Venue Login</h1>
            <p className="text-sm text-haven-muted">Sign in to manage your venue</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email}
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
          />
          <Button type="submit" loading={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        <p className="text-center text-sm text-haven-muted mt-6">
          No venue yet?{' '}
          <Link to="/auth/venue-register" className="text-haven-dark font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
