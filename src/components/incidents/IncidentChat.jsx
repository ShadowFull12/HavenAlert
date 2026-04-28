import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import useAuthStore from '../../store/authStore';
import Spinner from '../ui/Spinner';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function IncidentChat({ incidentId, isStaff = false }) {
  const { messages, loading, bottomRef } = useRealtimeMessages('incident_messages', 'incident_id', incidentId);
  const { user } = useAuthStore();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from('incident_messages').insert({
        incident_id: incidentId,
        sender_id: user.id,
        message: newMessage.trim(),
        is_staff: isStaff,
      });

      if (error) throw error;
      setNewMessage('');
    } catch (err) {
      console.error('Send message error:', err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Spinner className="py-8" />;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4 max-h-[400px] min-h-[200px]">
        {messages.length === 0 && (
          <p className="text-center text-haven-muted text-sm py-8">No messages yet</p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                isOwn
                  ? 'bg-haven-dark text-white rounded-br-md'
                  : msg.is_staff
                    ? 'bg-info-light text-info-dark rounded-bl-md'
                    : 'bg-gray-100 text-haven-dark rounded-bl-md'
              }`}>
                <p className="text-xs font-medium mb-0.5 opacity-70">
                  {msg.sender?.full_name || (isOwn ? 'You' : msg.is_staff ? 'Staff' : 'Guest')}
                </p>
                <p className="text-sm leading-relaxed">{msg.message}</p>
                <p className="text-[10px] opacity-50 mt-1">
                  {msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-gray-100 p-3 flex gap-2">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="input-field flex-1"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="btn-primary px-3 min-w-[44px] min-h-[44px]"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
