'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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

const getBorderLeftColor = (type: string) => {
  switch (type) {
    case 'success': return '#22c55e';
    case 'error':   return '#ef4444';
    case 'warning': return '#eab308';
    case 'info':    return '#3b82f6';
    default:        return '#6b7280';
  }
};

export default function Toast({ notification, onDismiss }: ToastProps) {
  const [progress, setProgress] = useState(100);

  const duration = notification.duration || 4000;

  useEffect(() => {
    if (!notification.duration) return;

    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss(notification.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [notification.id, notification.duration, duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="relative flex items-start gap-3 rounded-lg shadow-lg p-4 min-w-[320px] max-w-100 overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderLeftWidth: '4px',
        borderLeftColor: getBorderLeftColor(notification.type),
      }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.1 }}
      >
        {getIcon(notification.type)}
      </motion.div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--text-primary)' }}>
          {notification.message}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {new Date(notification.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      <button
        onClick={() => onDismiss(notification.id)}
        className="shrink-0 transition-colors"
        style={{ color: 'var(--text-muted)' }}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>

      {notification.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
          <motion.div
            className={`h-full ${getProgressColor(notification.type)}`}
            initial={{ width: "100%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: "linear" }}
          />
        </div>
      )}
    </motion.div>
  );
}
