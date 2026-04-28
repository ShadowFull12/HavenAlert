import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User } from 'lucide-react';
import { triageIncident } from '../../lib/gemini';
import Spinner from '../ui/Spinner';

export default function AITriage({ onTriageComplete, guestLanguage = 'en' }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'I\'m the HavenAlert AI assistant. Describe your emergency and I\'ll help classify it for the fastest response.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const result = await triageIncident(userMsg, guestLanguage);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `**Assessment:** ${result.severity} severity ${result.type} incident.\n\n${result.briefing}\n\n**Recommended actions:**\n${result.recommendedActions.map(a => `• ${a}`).join('\n')}`
      }]);

      if (onTriageComplete) {
        onTriageComplete(result);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: 'I\'m having trouble analyzing this right now. Your emergency has still been reported — staff will respond shortly.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Bot className="w-5 h-5 text-purple-600" />
        <span className="font-semibold text-sm text-haven-dark">AI Crisis Assistant</span>
      </div>

      <div className="p-4 space-y-3 max-h-[350px] overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-haven-dark text-white rounded-br-md'
                : 'bg-purple-50 text-haven-dark rounded-bl-md'
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                {msg.role === 'ai' ? <Bot className="w-3.5 h-3.5 text-purple-600" /> : <User className="w-3.5 h-3.5 opacity-70" />}
                <span className="text-xs font-medium opacity-70">{msg.role === 'ai' ? 'AI Assistant' : 'You'}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-purple-50 rounded-2xl rounded-bl-md px-4 py-3">
              <Spinner size="sm" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-gray-100 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe the emergency..."
          className="input-field flex-1"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="btn-primary px-3 min-w-[44px] min-h-[44px]"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
