import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useRealtimeIncidents(venueId) {
  const [incidents, setIncidents] = useState([]);
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

  useEffect(() => {
    // Clean up previous channel before setting up a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!venueId) {
      setLoading(false);
      setIncidents([]);
      return;
    }

    const fetchIncidents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          reported_by_profile:profiles!incidents_reported_by_fkey(full_name),
          assigned_to_profile:profiles!incidents_assigned_to_fkey(full_name)
        `)
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });

      if (!mountedRef.current) return;

      if (error) {
        console.error('Fetch incidents error:', error);
        toast.error('Failed to load incidents');
      } else {
        setIncidents(data || []);
      }
      setLoading(false);
    };

    fetchIncidents();

    // Set up realtime subscription
    const channel = supabase
      .channel(`incidents-${venueId}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incidents',
        filter: `venue_id=eq.${venueId}`
      }, (payload) => {
        if (!mountedRef.current) return;
        if (payload.eventType === 'INSERT') {
          setIncidents(prev => [payload.new, ...prev]);
          toast('🚨 New incident reported', { icon: '🚨' });
        }
        if (payload.eventType === 'UPDATE') {
          setIncidents(prev => prev.map(i => i.id === payload.new.id ? payload.new : i));
        }
        if (payload.eventType === 'DELETE') {
          setIncidents(prev => prev.filter(i => i.id !== payload.old.id));
        }
      })
      .subscribe();

    channelRef.current = channel;
  }, [venueId]);

  return { incidents, loading, setIncidents };
}
