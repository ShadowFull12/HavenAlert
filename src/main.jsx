import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Retry pending SOS from offline storage
const retryPendingSOS = async () => {
  const pending = JSON.parse(localStorage.getItem('pendingSOS') || '[]');
  if (pending.length === 0) return;

  const { supabase } = await import('./lib/supabase');

  for (let i = pending.length - 1; i >= 0; i--) {
    try {
      const item = pending[i];
      delete item._created;
      const { error } = await supabase.from('incidents').insert(item);
      if (!error) {
        pending.splice(i, 1);
      }
    } catch {
      // Will retry next interval
    }
  }
  localStorage.setItem('pendingSOS', JSON.stringify(pending));
};

// Retry every 5 seconds
setInterval(retryPendingSOS, 5000);
