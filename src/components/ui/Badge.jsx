import React from 'react';

const variantMap = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
  success: 'badge-success',
  info: 'badge-medium',
  warning: 'badge-high',
  danger: 'badge-critical',
  open: 'badge-critical',
  assigned: 'badge-medium',
  in_progress: 'badge-medium',
  escalated: 'badge-high',
  resolved: 'badge-success',
  closed: 'badge-low',
};

export default function Badge({ children, variant = 'medium', className = '' }) {
  return (
    <span className={`badge ${variantMap[variant] || 'badge-low'} ${className}`}>
      {children}
    </span>
  );
}
