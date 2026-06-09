'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useNotificationStore } from '@/store/notificationStore';
import type { NotificationCategory } from '@/types/notifications';

interface CategoryConfig {
  category: NotificationCategory;
  key: string; // translation subkey under notifications.prefs.cat.*
}

const CATEGORIES: CategoryConfig[] = [
  { category: 'dca',      key: 'dca' },
  { category: 'dca-out',  key: 'dcaOut' },
  { category: 'swap',     key: 'swap' },
  { category: 'send',     key: 'send' },
  { category: 'price',    key: 'price' },
  { category: 'wallet',   key: 'wallet' },
];

export default function NotificationPreferences() {
  const t = useTranslations('notifications');
  const { preferences, setPreference, resetPreferences } = useNotificationStore();

  const allOn = Object.values(preferences).every(Boolean);

  return (
    <div className="max-w-lg w-full mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            {t('prefs.title')}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('prefs.subtitle')}
          </p>
        </div>
        {!allOn && (
          <button
            onClick={resetPreferences}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--accent)' }}
          >
            {t('prefs.resetAll')}
          </button>
        )}
      </div>

      {/* Toggle list */}
      <div
        className="rounded-xl divide-y overflow-hidden"
        style={{ border: '1px solid var(--border-subtle)' }}
      >
        {CATEGORIES.map(({ category, key }) => {
          const enabled = preferences[category] ?? true;
          const label = t(`prefs.cat.${key}.label`);
          const description = t(`prefs.cat.${key}.desc`);
          return (
            <div
              key={category}
              className="flex items-center justify-between px-4 py-3.5 gap-4"
              style={{ backgroundColor: 'var(--bg-card)' }}
            >
              <div className="min-w-0">
                <p
                  className="text-sm font-medium"
                  style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  {label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {description}
                </p>
              </div>

              {/* Toggle switch */}
              <button
                role="switch"
                aria-checked={enabled}
                aria-label={t('prefs.toggleAria', { action: enabled ? t('prefs.disable') : t('prefs.enable'), label })}
                onClick={() => setPreference(category, !enabled)}
                className="relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2"
                style={{
                  backgroundColor: enabled ? 'var(--accent)' : 'var(--border-subtle)',
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: enabled ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        {t('prefs.footer')}
      </p>
    </div>
  );
}
