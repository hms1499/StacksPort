'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import type { Notification } from '@/types/notifications';
import { cn } from '@/lib/utils';

interface NotificationCardProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 size={24} className="text-green-600 flex-shrink-0" />;
    case 'error':
      return <AlertCircle size={24} className="text-red-600 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle size={24} className="text-yellow-600 flex-shrink-0" />;
    case 'info':
      return <Info size={24} className="text-blue-600 flex-shrink-0" />;
    default:
      return <Info size={24} className="text-gray-600 flex-shrink-0" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-green-50 border-green-200';
    case 'error':
      return 'bg-red-50 border-red-200';
    case 'warning':
      return 'bg-yellow-50 border-yellow-200';
    case 'info':
      return 'bg-blue-50 border-blue-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
};

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    dca: 'DCA Vault',
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
  const [isHovered, setIsHovered] = useState(false);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(notification.id);
    }
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-4 transition-all',
        getTypeColor(notification.type),
        isHovered && 'shadow-sm'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {onSelect && (
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={handleCheckboxChange}
            className="mt-1 w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer flex-shrink-0"
          />
        )}

        {/* Icon */}
        <div className="mt-0.5">{getIcon(notification.type)}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">{notification.message}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs font-medium px-2 py-1 bg-white bg-opacity-60 rounded text-gray-700">
                  {getCategoryLabel(notification.category)}
                </span>
                <span className="text-xs text-gray-600">
                  {new Date(notification.timestamp).toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => onDismiss(notification.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-1"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>

          {/* Context metadata */}
          {notification.context && (
            <div className="mt-3 text-xs text-gray-700 space-y-1">
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
