import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeMessages(tableName, foreignKey, foreignKeyValue) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!foreignKeyValue) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*, sender:profiles!sender_id(full_name)')
        .eq(foreignKey, foreignKeyValue)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`Fetch ${tableName} error:`, error);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    fetchMessages();

    const channel = supabase
      .channel(`${tableName}-${foreignKeyValue}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: tableName,
        filter: `${foreignKey}=eq.${foreignKeyValue}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [tableName, foreignKey, foreignKeyValue]);

  return { messages, loading, bottomRef, setMessages };
}
