'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/navigation";
import { Bell, ArrowRight, Trash2 } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import NotificationIcon from './NotificationIcon';
import { cn } from '@/lib/utils';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** The bell button — desktop dropdown anchors under it. */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function NotificationDrawer({ isOpen, onClose, anchorRef }: NotificationDrawerProps) {
  const t = useTranslations('notifications');
  const { notifications, dismissNotification, clearAll, markAllAsRead } = useNotificationStore();

  // The drawer is portaled to <body> so its `fixed` positioning resolves
  // against the viewport — the Topbar's backdrop-filter would otherwise make
  // the header a containing block and pin this bottom sheet inside it.
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isOpen && notifications.some((n) => !n.isRead)) {
      markAllAsRead();
    }
  }, [isOpen, notifications, markAllAsRead]);

  // Position the desktop dropdown right-aligned under the bell.
  useEffect(() => {
    if (!isOpen || isMobile || !anchorRef?.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setAnchor({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  }, [isOpen, isMobile, anchorRef]);

  if (!mounted) return null;

  const displayNotifications = notifications.slice(0, 20);

  const content = (
    <>
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
          {t('drawer.title')}
        </h3>
        {displayNotifications.length > 0 && (
          <button
            onClick={() => clearAll()}
            className="text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('drawer.clearAll')}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[60vh] md:max-h-96 overflow-y-auto">
        {displayNotifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Bell size={32} className="mx-auto mb-2" style={{ color: 'var(--border-subtle)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('drawer.empty')}
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
                  {/* Dùng NotificationIcon thay emoji text để đồng nhất với Toast và Card */}
                  <div className="mt-0.5 flex-shrink-0">
                    <NotificationIcon type={notification.type} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {/* Unread dot — visible trước khi drawer auto-markAllAsRead chạy */}
                      {!notification.isRead && (
                        <span
                          className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: 'var(--accent)' }}
                        />
                      )}
                      <p
                        className={`text-sm line-clamp-2 ${notification.isRead ? 'font-normal' : 'font-semibold'}`}
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {notification.message}
                      </p>
                    </div>
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
                    aria-label={t('dismiss')}
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
            color: 'var(--accent-text)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {t('drawer.viewAll')}
          <ArrowRight size={16} />
        </Link>
      )}

      {/* Bottom safe area — mobile only */}
      <div className="h-6 md:hidden" />
    </>
  );

  return createPortal(
    <>
      {/* Click-away overlay. Mobile gets a visible scrim; desktop is invisible. */}
      {isMobile ? (
        <div
          className={cn(
            'fixed inset-0 z-[60] transition-opacity duration-200',
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
          onClick={onClose}
          aria-hidden="true"
        />
      ) : (
        isOpen && (
          <div
            className="fixed inset-0 z-[60]"
            onClick={onClose}
            aria-hidden="true"
          />
        )
      )}

      {/* Drawer — bottom sheet on mobile, anchored dropdown on desktop */}
      <div
        className={cn(
          'fixed z-[61] border shadow-2xl transition-all duration-300 ease-out',
          isMobile
            ? cn(
                'bottom-0 left-0 right-0 rounded-t-2xl',
                isOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-full invisible'
              )
            : cn(
                'w-96 max-w-[calc(100vw-1rem)] rounded-2xl',
                isOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-2 invisible'
              )
        )}
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          ...(isMobile
            ? {}
            : { top: anchor?.top ?? 64, right: anchor?.right ?? 16 }),
        }}
      >
        {content}
      </div>
    </>,
    document.body
  );
}
