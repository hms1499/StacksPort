'use client';

import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import { NotificationDrawer } from './NotificationDrawer';

export default function NotificationBadge() {
  const { getUnreadCount, markAllAsRead } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = getUnreadCount();

  const handleOpen = () => {
    setIsOpen(true);
    markAllAsRead();
  };

  return (
    <div className="relative">
      <button
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className="relative p-2 rounded-xl transition-colors duration-150"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ backgroundColor: 'var(--negative)' }}
          />
        )}
      </button>

      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-4 h-4 text-[9px] font-bold rounded-full flex items-center justify-center px-1 pointer-events-none"
          style={{ backgroundColor: 'var(--negative)', color: '#fff' }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      <NotificationDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
