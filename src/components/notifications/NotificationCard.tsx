'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { X, ExternalLink } from 'lucide-react';
import type { Notification } from '@/types/notifications';
import NotificationIcon from './NotificationIcon';

interface NotificationCardProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}


// Trả về border-left color theo type để nhận diện nhanh mà không dùng background màu cứng.
// Dùng inline style thay Tailwind class để CSS variables của theme hoạt động đúng ở dark mode.
const getAccentColor = (type: string): string => {
  switch (type) {
    case 'success': return 'var(--positive)';
    case 'error':   return 'var(--negative)';
    case 'warning': return '#f59e0b';
    case 'info':    return 'var(--accent)';
    default:        return 'var(--border-subtle)';
  }
};

// Map notification category → translation subkey under notifications.category.*
const CATEGORY_KEY: Record<string, string> = {
  dca: 'dca',
  'dca-out': 'dcaOut',
  wallet: 'wallet',
  swap: 'swap',
  send: 'send',
  price: 'price',
};

export default function NotificationCard({
  notification,
  onDismiss,
  isSelected,
  onSelect,
}: NotificationCardProps) {
  const t = useTranslations('notifications');
  const accentColor = getAccentColor(notification.type);
  const categoryKey = CATEGORY_KEY[notification.category];
  const categoryLabel = categoryKey ? t(`category.${categoryKey}`) : notification.category;

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(notification.id);
  };

  return (
    <div
      className="rounded-lg p-4 transition-shadow hover:shadow-sm"
      style={{
        // Unread: nền hơi sáng hơn một chút để phân biệt với đã đọc
        backgroundColor: notification.isRead ? 'var(--bg-card)' : 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        // Border-left màu theo type — nhận diện nhanh mà không cần background tô màu
        borderLeftWidth: '3px',
        borderLeftColor: accentColor,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {onSelect && (
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={handleCheckboxChange}
            className="mt-1 w-5 h-5 rounded cursor-pointer flex-shrink-0"
            style={{ accentColor: 'var(--accent)' }}
          />
        )}

        {/* Icon */}
        <div className="mt-0.5">
          <NotificationIcon type={notification.type} size={24} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                {/* Unread dot — ẩn khi đã đọc */}
                {!notification.isRead && (
                  <span
                    className="flex-shrink-0 w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                    aria-label={t('unreadAria')}
                  />
                )}
                <p
                  className={notification.isRead ? 'font-medium' : 'font-semibold'}
                  style={{ color: 'var(--text-primary)' }}
                >
                  {notification.message}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {categoryLabel}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(notification.timestamp).toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => onDismiss(notification.id)}
              className="flex-shrink-0 transition-colors mt-1 hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              aria-label={t('dismiss')}
            >
              <X size={18} />
            </button>
          </div>

          {/* Context metadata — chip row thay vì key-value list dọc.
              Action field bị bỏ: nội dung đã có trong message, hiện lại là thừa. */}
          {notification.context && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {/* Amount chip */}
              {notification.context.amount && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {notification.context.amount}
                  {notification.context.tokenSymbol ? ` ${notification.context.tokenSymbol}` : ''}
                </span>
              )}

              {/* Plan ID chip — truncated để không chiếm nhiều space */}
              {notification.context.planId && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  title={notification.context.planId}
                >
                  {t('plan', { id: notification.context.planId.slice(-6) })}
                </span>
              )}

              {/* Tx ID — link chip ra Hiro Explorer để user verify on-chain */}
              {notification.context.txId && (
                <a
                  href={`https://explorer.hiro.so/txid/${notification.context.txId}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-mono transition-opacity hover:opacity-75"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                    color: 'var(--accent-text)',
                    border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                  }}
                  title={notification.context.txId}
                >
                  {notification.context.txId.slice(0, 6)}…{notification.context.txId.slice(-4)}
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
