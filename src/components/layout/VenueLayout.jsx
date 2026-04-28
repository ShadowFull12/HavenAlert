import React, { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, Users, DoorOpen, UserCog,
  MessageSquare, Megaphone, BarChart3, ScrollText, Settings,
  LogOut, Menu, X, Shield, ClipboardList
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useVenueStore from '../../store/venueStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationBell from '../ui/NotificationBell';
import Spinner from '../ui/Spinner';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function VenueLayout() {
  const { signOut, profile } = useAuthStore();
  const { venue, staffMember, loadVenueForUser } = useVenueStore();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const mountedRef = useRef(true);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications(profile?.id);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (venue && staffMember) return;

    setInitializing(true);
    loadVenueForUser(profile)
      .catch(err => console.error('Venue load error:', err))
      .finally(() => { if (mountedRef.current) setInitializing(false); });
  }, [profile?.id]);

  const isStaff = profile?.role === 'staff';

  const handleLeaveVenue = async () => {
    if (!confirm('Are you sure you want to leave this venue? You will lose all access and must be re-invited to join again.')) return;
    
    try {
      setInitializing(true);
      const { error } = await supabase.from('staff_members').delete().eq('profile_id', profile.id).eq('venue_id', venue.id);
      if (error) throw error;
      
      toast.success('You have left the venue.');
      
      // Update local profile state and redirect
      await useAuthStore.getState().refreshProfile();
      navigate('/auth/staff-login', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Failed to leave venue');
      setInitializing(false);
    }
  };

  const navItems = [
    { to: '/venue',            icon: LayoutDashboard, label: 'Dashboard',  show: true },
    { to: '/venue/tasks',      icon: ClipboardList,   label: 'My Tasks',   show: isStaff },
    { to: '/venue/incidents',  icon: AlertTriangle,   label: 'Incidents',  show: can('view_incidents') },
    { to: '/venue/queue',      icon: Users,           label: 'Guest Queue',show: can('view_guests') },
    { to: '/venue/rooms',      icon: DoorOpen,        label: 'Rooms',      show: can('view_rooms') },
    { to: '/venue/staff',      icon: UserCog,         label: 'Staff',      show: can('view_staff') },
    { to: '/venue/complaints', icon: MessageSquare,   label: 'Complaints', show: can('view_complaints') },
    { to: '/venue/broadcasts', icon: Megaphone,       label: 'Broadcasts', show: true },
    { to: '/venue/analytics',  icon: BarChart3,       label: 'Analytics',  show: can('view_analytics') },
    { to: '/venue/audit',      icon: ScrollText,      label: 'Audit Log',  show: can('view_analytics') },
    { to: '/venue/settings',   icon: Settings,        label: 'Settings',   show: can('manage_venue') },
  ].filter(i => i.show);

  const handleSignOut = async () => {
    await signOut();
    useVenueStore.getState().reset?.();
    navigate('/');
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" className="mb-4" />
          <p className="text-sm text-haven-muted">Loading venue...</p>
        </div>
      </div>
    );
  }

  if (!venue && !initializing && profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-warning" />
          </div>
          <h2 className="text-xl font-bold text-haven-dark mb-2">No Venue Found</h2>
          <p className="text-haven-muted text-sm mb-6">
            Your account isn't linked to a venue. Register a venue or contact your manager.
          </p>
          <button onClick={handleSignOut} className="btn-primary w-full">Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside className="sidebar hidden md:flex">
        <div className="px-5 py-6 border-b border-haven-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-danger/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-danger" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-white text-sm">HavenAlert</h2>
              <p className="text-xs text-slate-400 truncate max-w-[150px]">{venue?.name || 'Loading...'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/venue'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-haven-border">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-haven-surface flex items-center justify-center text-xs font-bold text-white">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name}</p>
              <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 mb-2"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
          
          {profile?.role !== 'owner' && (
            <button
              onClick={handleLeaveVenue}
              className="sidebar-link w-full text-slate-400 hover:text-white hover:bg-haven-border/50 text-xs py-2"
            >
              <UserCog className="w-4 h-4" /> Leave Venue
            </button>
          )}
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <header className="md:hidden bg-haven-dark text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-haven-surface min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-sm">HavenAlert</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            markAsRead={markAsRead}
            markAllAsRead={markAllAsRead}
            deleteNotification={deleteNotification}
          />
          <span className="text-xs text-slate-400 truncate max-w-[100px]">{venue?.name}</span>
        </div>
      </header>

      {/* Desktop header bar (above main content on desktop) */}
      <div className="hidden md:flex fixed top-0 left-64 right-0 h-14 bg-white border-b border-gray-200 z-20 items-center justify-between px-6">
        <h1 className="text-sm font-semibold text-haven-dark">{venue?.name}</h1>
        <div className="flex items-center gap-3">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            markAsRead={markAsRead}
            markAllAsRead={markAllAsRead}
            deleteNotification={deleteNotification}
          />
          <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
            <div className="w-7 h-7 rounded-full bg-haven-dark flex items-center justify-center text-xs font-bold text-white">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-sm font-medium text-haven-dark">{profile?.full_name}</span>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-haven-dark overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-6 border-b border-haven-border flex items-center gap-3">
              <Shield className="w-6 h-6 text-danger" />
              <div>
                <span className="font-bold text-white block">HavenAlert</span>
                <span className="text-xs text-slate-400">{venue?.name}</span>
              </div>
            </div>
            <nav className="flex-1 py-4">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/venue'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon className="w-5 h-5" /> {label}
                </NavLink>
              ))}
            </nav>
            <div className="px-4 py-4 border-t border-haven-border">
              <button onClick={() => { setSidebarOpen(false); handleSignOut(); }} className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 mb-2">
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
              {profile?.role !== 'owner' && (
                <button
                  onClick={() => { setSidebarOpen(false); handleLeaveVenue(); }}
                  className="sidebar-link w-full text-slate-400 hover:text-white hover:bg-haven-border/50 text-xs py-2"
                >
                  <UserCog className="w-4 h-4" /> Leave Venue
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="md:ml-64 md:pt-14 min-h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav md:hidden">
        {navItems.slice(0, 5).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/venue'}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
