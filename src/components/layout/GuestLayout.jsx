import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, AlertTriangle, MessageSquare, User, LogOut, Shield, Menu, X } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationBell from '../ui/NotificationBell';

const navItems = [
  { to: '/guest',            icon: Home,           label: 'Home',      end: true },
  { to: '/guest/sos',        icon: AlertTriangle,  label: 'SOS' },
  { to: '/guest/complaints', icon: MessageSquare,  label: 'Complaints' },
  { to: '/guest/profile',    icon: User,           label: 'Profile' },
];

export default function GuestLayout() {
  const { signOut, profile } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications(profile?.id);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-haven-light">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="px-5 py-6 border-b border-haven-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-info" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">HavenAlert</h2>
              <p className="text-xs text-slate-400">Guest Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5" /> {label}
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
              <p className="text-xs text-slate-400 capitalize">Guest</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Desktop top bar */}
      <div className="hidden md:flex fixed top-0 left-64 right-0 h-14 bg-white border-b border-gray-200 z-20 items-center justify-between px-6">
        <h1 className="text-sm font-semibold text-haven-dark">Guest Dashboard</h1>
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
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-haven-dark overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-6 border-b border-haven-border flex items-center gap-3">
              <Shield className="w-6 h-6 text-info" />
              <div>
                <span className="font-bold text-white block">HavenAlert</span>
                <span className="text-xs text-slate-400">Guest Portal</span>
              </div>
            </div>
            <nav className="flex-1 py-4">
              {navItems.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon className="w-5 h-5" /> {label}
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
                  <p className="text-xs text-slate-400">Guest</p>
                </div>
              </div>
              <button onClick={handleSignOut} className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="md:ml-64 md:pt-14 min-h-screen pb-24 md:pb-0">
        <div className="px-4 py-6 max-w-2xl mx-auto md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav md:hidden">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
