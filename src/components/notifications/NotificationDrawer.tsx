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

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const { notifications, dismissNotification, clearAll } = useNotificationStore();

  // Show last 20 notifications
  const displayNotifications = notifications.slice(0, 20);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '!';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-0"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'absolute top-full right-0 mt-2 w-96 max-w-[calc(100vw-1rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-40 transition-all duration-200 ease-out',
          isOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-2 invisible'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          {displayNotifications.length > 0 && (
            <button
              onClick={() => clearAll()}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {displayNotifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No notifications yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {displayNotifications.map((notification) => (
                <li
                  key={notification.id}
                  className={cn('px-4 py-3 hover:bg-gray-50 transition-colors group', getTypeColor(notification.type))}
                >
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                      {getIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
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
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-all"
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
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-[#285A48] hover:text-[#285A48] hover:bg-[#B0E4CC]/20 transition-colors border-t border-gray-100"
          >
            View all
            <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </>
  );
}
