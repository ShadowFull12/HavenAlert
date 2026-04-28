import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function GuestLogin() {
  const navigate = useNavigate();
  const { signIn, user } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Auto-redirect once auth state is committed
  useEffect(() => {
    if (done && user) navigate('/guest', { replace: true });
  }, [done, user]);

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
    const { error } = await signIn(form.email.trim(), form.password);
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Login failed');
    } else {
      toast.success('Welcome back!');
      setDone(true);
    }
  };

  return (
    <div className="min-h-screen bg-haven-light flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-haven-muted text-sm mb-8 hover:text-haven-dark transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-haven-dark flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-haven-dark">Guest Login</h1>
            <p className="text-sm text-haven-muted">Sign in to your HavenAlert account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="john@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
          />
          <Button type="submit" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>

        <p className="text-center text-sm text-haven-muted mt-6">
          Don't have an account?{' '}
          <Link to="/auth/guest-register" className="text-haven-dark font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
