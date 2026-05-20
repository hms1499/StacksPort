'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, BellRing, Settings } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import NotificationsContent from './NotificationsContent';
import PriceAlertForm from '@/components/price-alerts/PriceAlertForm';
import PriceAlertsList from '@/components/price-alerts/PriceAlertsList';
import NotificationPreferences from './NotificationPreferences';
import { cn } from '@/lib/utils';

type Tab = 'activity' | 'price-alerts' | 'preferences';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'activity',     label: 'Activity',      icon: Bell },
  { id: 'price-alerts', label: 'Price Alerts',  icon: BellRing },
  { id: 'preferences',  label: 'Preferences',   icon: Settings },
];

export default function NotificationsPageWrapper() {
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
      <Topbar title="Notifications" />

      {/* Tab bar */}
      <div className="px-4 md:px-6" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors')}
              style={activeTab === id
                ? { borderColor: '#408A71', color: 'var(--accent)' }
                : { borderColor: 'transparent', color: 'var(--text-muted)' }
              }
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        {activeTab === 'activity' ? (
          <NotificationsContent />
        ) : activeTab === 'price-alerts' ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl mx-auto w-full space-y-6">
            <PriceAlertForm />
            <PriceAlertsList />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <NotificationPreferences />
          </div>
        )}
      </div>
    </div>
  );
}
