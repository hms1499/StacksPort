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

const getBorderColor = (type: string) => {
  switch (type) {
    case 'success':
      return 'border-l-green-500';
    case 'error':
      return 'border-l-red-500';
    case 'warning':
      return 'border-l-yellow-500';
    case 'info':
      return 'border-l-blue-500';
    default:
      return 'border-l-gray-500';
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
      className={`
        relative flex items-start gap-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 min-w-[320px] max-w-100
        border border-gray-100 dark:border-gray-700 border-l-4 ${getBorderColor(notification.type)} overflow-hidden
      `}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.1 }}
      >
        {getIcon(notification.type)}
      </motion.div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {new Date(notification.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      <button
        onClick={() => onDismiss(notification.id)}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>

      {notification.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-700 overflow-hidden">
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
