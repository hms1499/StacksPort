'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { Notification } from '@/types/notifications';

interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />;
    case 'error':
      return <AlertCircle size={20} className="text-red-500 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0" />;
    case 'info':
      return <Info size={20} className="text-blue-500 flex-shrink-0" />;
    default:
      return <Info size={20} className="text-gray-500 flex-shrink-0" />;
  }
};

const getProgressColor = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'info':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
};

export default function Toast({ notification, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const duration = notification.duration || 4000;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!notification.duration) return;

    const startTime = Date.now();

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setIsExiting(true);
        setTimeout(() => {
          onDismiss(notification.id);
        }, 300);
      }
    }, 10);

    return () => clearInterval(interval);
  }, [notification.id, notification.duration, duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  };

  return (
    <div
      className={`
        relative flex items-start gap-3 bg-white rounded-lg shadow-lg p-4 min-w-[320px] max-w-100
        border border-gray-100 transition-all duration-300 ease-out overflow-hidden
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
    >
      {getIcon(notification.type)}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {new Date(notification.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>

      {notification.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 rounded-b-lg overflow-hidden">
          <div
            className={`h-full ${getProgressColor(notification.type)} transition-all ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
