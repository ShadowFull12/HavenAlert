import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

export default function EmptyState({ icon: Icon = Inbox, title, message, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-haven-muted" />
      </div>
      <h3 className="text-lg font-semibold text-haven-dark mb-1">{title}</h3>
      <p className="text-haven-muted text-sm max-w-xs mb-6">{message}</p>
      {action && onAction && (
        <Button onClick={onAction}>{action}</Button>
      )}
    </div>
  );
}
