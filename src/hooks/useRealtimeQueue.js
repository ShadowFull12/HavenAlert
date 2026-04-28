import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useRealtimeQueue(venueId) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!venueId) return;

    const fetchQueue = async () => {
      const { data, error } = await supabase
        .from('guest_queue')
        .select('*, guest:profiles!guest_queue_guest_id_fkey(full_name, phone, email:id)')
        .eq('venue_id', venueId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: true });

      if (error) {
        console.error('Fetch queue error:', error);
      } else {
        setQueue(data || []);
      }
      setLoading(false);
    };

    fetchQueue();

    const channel = supabase
      .channel(`queue-${venueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'guest_queue',
        filter: `venue_id=eq.${venueId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setQueue(prev => [...prev, payload.new]);
          toast('New guest in queue', { icon: '👋' });
        }
        if (payload.eventType === 'UPDATE') {
          if (payload.new.status === 'processed') {
            setQueue(prev => prev.filter(q => q.id !== payload.new.id));
          } else {
            setQueue(prev => prev.map(q => q.id === payload.new.id ? payload.new : q));
          }
        }
        if (payload.eventType === 'DELETE') {
          setQueue(prev => prev.filter(q => q.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [venueId]);

  return { queue, loading };
}
