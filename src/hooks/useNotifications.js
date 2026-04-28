import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Icon map for toast display
const TYPE_ICONS = {
  // Incidents
  new_incident:              '🚨',
  new_incident_info:         '🚨',
  incident_assigned:         '🚨',
  incident_unassigned:       '🔄',
  incident_update:           '📋',
  incident_escalated:        '🔺',
  incident_reopened:         '🔁',
  incident_resolved_pending: '⏳',
  // Complaints
  new_complaint:             '💬',
  new_complaint_info:        '💬',
  complaint_assigned:        '💬',
  complaint_unassigned:      '🔄',
  complaint_update:          '💬',
  complaint_reopened:        '🔁',
  complaint_resolved_pending:'⏳',
  // Resolution
  resolution_request:        '✅',
  ready_to_close:            '✅',
  // Guests
  guest_checkin:             '🏨',
  room_assigned:             '🏨',
  // Misc
  broadcast:                 '📢',
  info:                      '🔔',
};

// Toast priority config
const URGENT_TYPES = new Set([
  'incident_assigned', 'incident_escalated', 'incident_reopened',
  'complaint_assigned', 'complaint_reopened',
  'new_incident', 'new_complaint',
  'resolution_request', 'ready_to_close',
]);

const INFO_TYPES = new Set([
  'new_incident_info', 'new_complaint_info',
  'incident_unassigned', 'complaint_unassigned',
]);

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && mountedRef.current) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    }
    if (mountedRef.current) setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase
      .channel(`notifs-${userId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (!mountedRef.current) return;
        const n = payload.new;
        const icon = TYPE_ICONS[n.type] || '🔔';

        setNotifications(prev => [n, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Differentiate toast urgency
        if (URGENT_TYPES.has(n.type)) {
          toast(`${icon} ${n.title}\n${n.message}`, {
            duration: 7000,
            style: { fontWeight: '500' },
          });
        } else if (INFO_TYPES.has(n.type)) {
          toast(`${icon} ${n.title}\n${n.message}`, {
            duration: 4000,
            style: { color: '#64748b', fontSize: '0.85rem' },
          });
        } else {
          toast(`${icon} ${n.title}\n${n.message}`, { duration: 5000 });
        }
      })
      .subscribe();

    channelRef.current = ch;
  }, [userId]);

  const markAsRead = useCallback(async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (mountedRef.current) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    await supabase.from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (mountedRef.current) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  }, [userId]);

  const deleteNotification = useCallback(async (id) => {
    await supabase.from('notifications').delete().eq('id', id);
    if (mountedRef.current) {
      setNotifications(prev => {
        const updated = prev.filter(n => n.id !== id);
        setUnreadCount(updated.filter(n => !n.read).length);
        return updated;
      });
    }
  }, []);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification };
}
