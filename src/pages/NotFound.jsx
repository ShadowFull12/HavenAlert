import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-haven-light flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-haven-muted" />
        </div>
        <h1 className="text-4xl font-bold text-haven-dark mb-2">404</h1>
        <p className="text-haven-muted mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Button onClick={() => navigate('/')}>
          <Home className="w-4 h-4" /> Back to Home
        </Button>
      </div>
    </div>
  );
}
