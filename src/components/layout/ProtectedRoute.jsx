import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import Spinner from '../ui/Spinner';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    // Allow owner/manager to access venue routes
    if (requiredRole === 'staff' && (profile?.role === 'owner' || profile?.role === 'manager')) {
      return children;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
