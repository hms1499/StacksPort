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

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        className="relative p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label={`Notifications ${unreadCount ? `(${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>

      {/* Count badge */}
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 min-w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 pointer-events-none">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      <NotificationDrawer isOpen={isOpen} onClose={handleClose} />
    </div>
  );
}
