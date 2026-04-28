import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({ children, variant = 'primary', loading, className = '', ...props }) {
  const base = {
    primary: 'btn-primary',
    danger: 'btn-danger',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
  };

  return (
    <button
      className={`${base[variant] || base.primary} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
