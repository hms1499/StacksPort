'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Notification } from '@/types/notifications';
import NotificationIcon from './NotificationIcon';

interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

// Map type → CSS variable để đồng nhất với NotificationIcon và NotificationCard
const ACCENT_COLORS: Record<string, string> = {
  success: 'var(--positive)',
  error:   'var(--negative)',
  warning: '#f59e0b',
  info:    'var(--accent)',
};

// Progress bar dùng inline background-color thay Tailwind class hardcode
// để đồng nhất với hệ thống CSS variables của app
const getProgressStyle = (type: string): React.CSSProperties => ({
  backgroundColor: ACCENT_COLORS[type] ?? 'var(--text-muted)',
});

export default function Toast({ notification, onDismiss }: ToastProps) {
  const duration = notification.duration || 4000;

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
        borderLeftColor: ACCENT_COLORS[notification.type] ?? 'var(--text-muted)',
      }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.1 }}
      >
        <NotificationIcon type={notification.type} size={20} />
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
        // CSS animation chạy hoàn toàn trên compositor thread — không cần JS timer hay state.
        // onAnimationEnd dismiss toast khi animation kết thúc thay vì dùng setTimeout ở store.
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
          <div
            style={{
              ...getProgressStyle(notification.type),
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
            onAnimationEnd={() => onDismiss(notification.id)}
          />
        </div>
      )}
    </motion.div>
  );
}
