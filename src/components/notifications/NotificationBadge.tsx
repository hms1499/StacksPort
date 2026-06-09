'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import { NotificationDrawer } from './NotificationDrawer';

export default function NotificationBadge() {
  const t = useTranslations('notifications');
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Selector trả về primitive (number) → Zustand chỉ re-render khi count thực sự thay đổi,
  // không phải mỗi khi bất kỳ notification nào update.
  const unreadCount = useNotificationStore(
    (s) => s.notifications.filter((n) => !n.isRead).length
  );

  // Trigger a one-shot bell shake when the unread count increases.
  const prevCount = useRef(unreadCount);
  const [shake, setShake] = useState(0);
  useEffect(() => {
    if (unreadCount > prevCount.current) setShake((n) => n + 1);
    prevCount.current = unreadCount;
  }, [unreadCount]);

  // markAllAsRead được xử lý bởi NotificationDrawer (useEffect khi isOpen = true)
  // để giữ responsibility trong một nơi duy nhất.
  const handleOpen = () => setIsOpen(true);

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className="relative p-2 rounded-xl transition-colors duration-150"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        aria-label={t('badge.aria', { count: unreadCount })}
      >
        <motion.span
          key={shake}
          animate={shake > 0 ? { rotate: [0, -14, 12, -8, 6, 0] } : { rotate: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="inline-flex"
        >
          <Bell size={18} />
        </motion.span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex">
            <span
              className="absolute inline-flex w-2 h-2 rounded-full opacity-75 animate-ping"
              style={{ backgroundColor: 'var(--negative)' }}
            />
            <span
              className="relative inline-flex w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--negative)' }}
            />
          </span>
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

      <NotificationDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} anchorRef={bellRef} />
    </div>
  );
}
