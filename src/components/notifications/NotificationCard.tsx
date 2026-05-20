'use client';

import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import type { Notification } from '@/types/notifications';

interface NotificationCardProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 size={24} className="flex-shrink-0" style={{ color: 'var(--positive)' }} />;
    case 'error':
      return <AlertCircle size={24} className="flex-shrink-0" style={{ color: 'var(--negative)' }} />;
    case 'warning':
      return <AlertTriangle size={24} className="flex-shrink-0" style={{ color: '#f59e0b' }} />;
    case 'info':
      return <Info size={24} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />;
    default:
      return <Info size={24} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />;
  }
};

// Trả về border-left color theo type để nhận diện nhanh mà không dùng background màu cứng.
// Dùng inline style thay Tailwind class để CSS variables của theme hoạt động đúng ở dark mode.
const getAccentColor = (type: string): string => {
  switch (type) {
    case 'success': return 'var(--positive)';
    case 'error':   return 'var(--negative)';
    case 'warning': return '#f59e0b';
    case 'info':    return 'var(--accent)';
    default:        return 'var(--border-subtle)';
  }
};

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    dca: 'DCA Vault',
    'dca-out': 'DCA Out',
    wallet: 'Wallet',
    swap: 'Swap',
    send: 'Send',
    price: 'Price Alert',
  };
  return labels[category] || category;
};

export default function NotificationCard({
  notification,
  onDismiss,
  isSelected,
  onSelect,
}: NotificationCardProps) {
  const accentColor = getAccentColor(notification.type);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(notification.id);
  };

  return (
    <div
      className="rounded-lg p-4 transition-shadow hover:shadow-sm"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        // Border-left màu theo type — nhận diện nhanh mà không cần background tô màu
        borderLeftWidth: '3px',
        borderLeftColor: accentColor,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {onSelect && (
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={handleCheckboxChange}
            className="mt-1 w-5 h-5 rounded cursor-pointer flex-shrink-0"
            style={{ accentColor: 'var(--accent)' }}
          />
        )}

        {/* Icon */}
        <div className="mt-0.5">{getIcon(notification.type)}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {notification.message}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {getCategoryLabel(notification.category)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(notification.timestamp).toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => onDismiss(notification.id)}
              className="flex-shrink-0 transition-colors mt-1 hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>

          {/* Context metadata */}
          {notification.context && (
            <div className="mt-3 text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
              {notification.context.action && (
                <p>
                  <span className="font-medium">Action:</span> {notification.context.action}
                </p>
              )}
              {notification.context.planId && (
                <p>
                  <span className="font-medium">Plan ID:</span> {notification.context.planId}
                </p>
              )}
              {notification.context.txId && (
                <p>
                  <span className="font-medium">Tx ID:</span> {notification.context.txId}
                </p>
              )}
              {notification.context.amount && (
                <p>
                  <span className="font-medium">Amount:</span> {notification.context.amount}{' '}
                  {notification.context.tokenSymbol || ''}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
