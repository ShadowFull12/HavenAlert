import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const TYPE_CONFIG = {
  // ── Incidents ──────────────────────────────────────────────────────────────
  new_incident:              { bg: 'bg-red-100',    text: 'text-red-600',    icon: '🚨' },
  new_incident_info:         { bg: 'bg-slate-100',  text: 'text-slate-500',  icon: '🚨' },
  incident_assigned:         { bg: 'bg-orange-100', text: 'text-orange-600', icon: '🚨' },
  incident_unassigned:       { bg: 'bg-slate-100',  text: 'text-slate-500',  icon: '🔄' },
  incident_update:           { bg: 'bg-blue-100',   text: 'text-blue-600',   icon: '📋' },
  incident_escalated:        { bg: 'bg-red-100',    text: 'text-red-700',    icon: '🔺' },
  incident_reopened:         { bg: 'bg-orange-100', text: 'text-orange-700', icon: '🔁' },
  incident_resolved_pending: { bg: 'bg-amber-100',  text: 'text-amber-600',  icon: '⏳' },
  // ── Complaints ─────────────────────────────────────────────────────────────
  new_complaint:             { bg: 'bg-purple-100', text: 'text-purple-600', icon: '💬' },
  new_complaint_info:        { bg: 'bg-slate-100',  text: 'text-slate-500',  icon: '💬' },
  complaint_assigned:        { bg: 'bg-purple-100', text: 'text-purple-600', icon: '💬' },
  complaint_unassigned:      { bg: 'bg-slate-100',  text: 'text-slate-500',  icon: '🔄' },
  complaint_update:          { bg: 'bg-purple-100', text: 'text-purple-600', icon: '💬' },
  complaint_reopened:        { bg: 'bg-orange-100', text: 'text-orange-700', icon: '🔁' },
  complaint_resolved_pending:{ bg: 'bg-amber-100',  text: 'text-amber-600',  icon: '⏳' },
  // ── Resolution flow ────────────────────────────────────────────────────────
  resolution_request:        { bg: 'bg-amber-100',  text: 'text-amber-600',  icon: '✅' },
  ready_to_close:            { bg: 'bg-green-100',  text: 'text-green-600',  icon: '✅' },
  // ── Guests & Rooms ─────────────────────────────────────────────────────────
  guest_checkin:             { bg: 'bg-teal-100',   text: 'text-teal-600',   icon: '🏨' },
  room_assigned:             { bg: 'bg-green-100',  text: 'text-green-600',  icon: '🏨' },
  // ── Broadcasts ─────────────────────────────────────────────────────────────
  broadcast:                 { bg: 'bg-sky-100',    text: 'text-sky-600',    icon: '📢' },
  // ── Fallback ───────────────────────────────────────────────────────────────
  info:                      { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: '🔔' },
};


export default function NotificationBell({ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleClick = (n) => {
    if (!n.read) markAsRead(n.id);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-haven-surface transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      {open && (
        <div className="absolute right-0 top-10 w-80 max-h-[480px] bg-haven-dark border border-haven-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-haven-border">
            <span className="text-sm font-semibold text-white">
              Notifications {unreadCount > 0 && <span className="text-red-400">({unreadCount})</span>}
            </span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-haven-surface transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-haven-surface text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-haven-border/50 cursor-pointer hover:bg-haven-surface/50 transition-colors ${!n.read ? 'bg-haven-surface/30' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center text-sm flex-shrink-0 mt-0.5`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-tight ${!n.read ? 'text-white' : 'text-slate-400'}`}>
                          {n.title}
                        </p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-600 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      className="p-1 rounded hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
