'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, ArrowRight, Trash2 } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import { cn } from '@/lib/utils';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  success: 'var(--positive)',
  error: 'var(--negative)',
  warning: '#f59e0b',
  info: 'var(--accent)',
};

const TYPE_ICONS: Record<string, string> = {
  success: '✓',
  error: '!',
  warning: '⚠',
  info: 'ℹ',
};

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const { notifications, dismissNotification, clearAll } = useNotificationStore();

  const displayNotifications = notifications.slice(0, 20);

  const iconColor = (type: string) => TYPE_COLORS[type] ?? 'var(--text-muted)';
  const icon = (type: string) => TYPE_ICONS[type] ?? '•';

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          'fixed inset-0 z-30 md:hidden transition-opacity duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Desktop overlay (click-away, no visual) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 hidden md:block"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer — bottom sheet on mobile, dropdown on desktop */}
      <div
        className={cn(
          // Mobile: fixed bottom sheet
          'fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl',
          // Desktop: absolute dropdown from bell button
          'md:absolute md:bottom-auto md:left-auto md:right-0 md:top-full md:mt-2 md:w-96 md:max-w-[calc(100vw-1rem)] md:rounded-2xl',
          'border shadow-2xl transition-all duration-300 ease-out',
          isOpen
            ? 'opacity-100 translate-y-0 visible'
            : 'opacity-0 translate-y-full md:-translate-y-2 invisible'
        )}
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: 'var(--border-subtle)' }}
          />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Notifications
          </h3>
          {displayNotifications.length > 0 && (
            <button
              onClick={() => clearAll()}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear all
            </button>
          )}
        </div>

        {/* Content */}
        <div className="max-h-[60vh] md:max-h-96 overflow-y-auto">
          {displayNotifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell size={32} className="mx-auto mb-2" style={{ color: 'var(--border-subtle)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No notifications yet
              </p>
            </div>
          ) : (
            <ul>
              {displayNotifications.map((notification, idx) => (
                <li
                  key={notification.id}
                  className="group"
                  style={{
                    borderBottom: idx < displayNotifications.length - 1
                      ? '1px solid var(--border-subtle)'
                      : undefined,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                >
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                      style={{
                        color: iconColor(notification.type),
                        backgroundColor: `color-mix(in srgb, ${iconColor(notification.type)} 15%, transparent)`,
                      }}
                    >
                      {icon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium line-clamp-2"
                        style={{ color: 'var(--text-primary)' }}
                      >
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
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(notification.id);
                      }}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--text-muted)' }}
                      aria-label="Dismiss"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {displayNotifications.length > 0 && (
          <Link
            href="/notifications"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium border-t transition-opacity hover:opacity-80"
            style={{
              color: 'var(--accent)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            View all
            <ArrowRight size={16} />
          </Link>
        )}

        {/* Bottom safe area — mobile only */}
        <div className="h-6 md:hidden" />
      </div>
    </>
  );
}
