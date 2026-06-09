'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Bell, BellRing, Settings } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import NotificationsContent from './NotificationsContent';
import PriceAlertForm from '@/components/price-alerts/PriceAlertForm';
import PriceAlertsList from '@/components/price-alerts/PriceAlertsList';
import PushPermissionBanner from '@/components/price-alerts/PushPermissionBanner';
import NotificationPreferences from './NotificationPreferences';
import AnimatedPage from '@/components/motion/AnimatedPage';
import { AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type Tab = 'activity' | 'price-alerts' | 'preferences';

const tabs: { id: Tab; tKey: string; icon: React.ElementType }[] = [
  { id: 'activity',     tKey: 'activity',     icon: Bell },
  { id: 'price-alerts', tKey: 'priceAlerts',  icon: BellRing },
  { id: 'preferences',  tKey: 'preferences',  icon: Settings },
];

export default function NotificationsPageWrapper() {
  const t = useTranslations('notifications');
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) ?? 'activity';

  const handleTabChange = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'activity') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.replace(`/notifications${params.size ? `?${params}` : ''}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={t('pageTitle')} />

      {/* Tab bar */}
      <div className="px-4 md:px-6" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, tKey, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0')}
              style={activeTab === id
                ? { borderColor: '#408A71', color: 'var(--accent)' }
                : { borderColor: 'transparent', color: 'var(--text-muted)' }
              }
            >
              <Icon size={16} />
              {t(`pageTabs.${tKey}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'activity' ? (
            <NotificationsContent key="activity" />
          ) : activeTab === 'price-alerts' ? (
            <AnimatedPage
              key="price-alerts"
              className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl mx-auto w-full space-y-6"
            >
              <PushPermissionBanner />
              <PriceAlertForm />
              <PriceAlertsList />
            </AnimatedPage>
          ) : (
            <AnimatedPage key="preferences" className="flex-1 overflow-y-auto p-4 md:p-6">
              <NotificationPreferences />
            </AnimatedPage>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
