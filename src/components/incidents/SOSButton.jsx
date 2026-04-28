import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function SOSButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full max-w-xs mx-auto aspect-square rounded-full bg-danger text-white 
                 flex flex-col items-center justify-center gap-3 shadow-2xl shadow-danger/30
                 active:scale-[0.97] disabled:opacity-70 transition-transform duration-100
                 will-change-transform"
      style={{ minWidth: '200px', minHeight: '200px' }}
    >
      <AlertTriangle className="w-16 h-16" strokeWidth={2.5} />
      <span className="text-2xl font-bold tracking-wide">
        {loading ? 'SENDING...' : 'SEND SOS'}
      </span>
    </button>
  );
}
