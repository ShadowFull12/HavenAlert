import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import Spinner from './components/ui/Spinner';

// Layouts
import GuestLayout from './components/layout/GuestLayout';
import VenueLayout from './components/layout/VenueLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Pages
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';

// Auth
import GuestRegister from './pages/auth/GuestRegister';
import GuestLogin from './pages/auth/GuestLogin';
import VenueRegister from './pages/auth/VenueRegister';
import VenueLogin from './pages/auth/VenueLogin';
import StaffLogin from './pages/auth/StaffLogin';
import StaffRegister from './pages/auth/StaffRegister';

// Guest
import GuestDashboard from './pages/guest/GuestDashboard';
import GuestSOS from './pages/guest/GuestSOS';
import GuestIncidentChat from './pages/guest/GuestIncidentChat';
import GuestComplaints from './pages/guest/GuestComplaints';
import GuestProfile from './pages/guest/GuestProfile';

// Venue
import VenueDashboard from './pages/venue/VenueDashboard';
import IncidentBoard from './pages/venue/IncidentBoard';
import IncidentDetail from './pages/venue/IncidentDetail';
import GuestQueue from './pages/venue/GuestQueue';
import RoomManager from './pages/venue/RoomManager';
import StaffManager from './pages/venue/StaffManager';
import ComplaintsBoard from './pages/venue/ComplaintsBoard';
import ComplaintDetail from './pages/venue/ComplaintDetail';
import Broadcasts from './pages/venue/Broadcasts';
import Analytics from './pages/venue/Analytics';
import AuditLog from './pages/venue/AuditLog';
import VenueSettings from './pages/venue/VenueSettings';
import MyTasks from './pages/venue/MyTasks';

export default function App() {
  const { initialize, loading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  // Emergency fallback — loading can never be stuck more than 7 seconds
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      useAuthStore.setState({ loading: false });
    }, 7000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haven-light">
        <div className="text-center">
          <Spinner size="lg" className="mb-4" />
          <p className="text-sm text-haven-muted">Loading HavenAlert...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#0F172A',
            color: '#fff',
            fontSize: '14px',
            borderRadius: '12px',
            padding: '12px 16px',
          },
        }}
      />

      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />

        {/* Auth */}
        <Route path="/auth/guest-register" element={<GuestRegister />} />
        <Route path="/auth/guest-login" element={<GuestLogin />} />
        <Route path="/auth/venue-register" element={<VenueRegister />} />
        <Route path="/auth/venue-login" element={<VenueLogin />} />
        <Route path="/auth/staff-login" element={<StaffLogin />} />
        <Route path="/auth/staff-register" element={<StaffRegister />} />

        {/* Guest routes */}
        <Route path="/guest" element={
          <ProtectedRoute>
            <GuestLayout />
          </ProtectedRoute>
        }>
          <Route index element={<GuestDashboard />} />
          <Route path="sos" element={<GuestSOS />} />
          <Route path="incident/:id" element={<GuestIncidentChat />} />
          <Route path="complaints" element={<GuestComplaints />} />
          <Route path="profile" element={<GuestProfile />} />
        </Route>

        {/* Venue routes */}
        <Route path="/venue" element={
          <ProtectedRoute>
            <VenueLayout />
          </ProtectedRoute>
        }>
          <Route index element={<VenueDashboard />} />
          <Route path="incidents" element={<IncidentBoard />} />
          <Route path="incidents/:id" element={<IncidentDetail />} />
          <Route path="queue" element={<GuestQueue />} />
          <Route path="rooms" element={<RoomManager />} />
          <Route path="staff" element={<StaffManager />} />
          <Route path="complaints" element={<ComplaintsBoard />} />
          <Route path="complaints/:id" element={<ComplaintDetail />} />
          <Route path="broadcasts" element={<Broadcasts />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="settings" element={<VenueSettings />} />
          <Route path="tasks" element={<MyTasks />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
