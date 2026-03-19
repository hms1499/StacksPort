'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, BellRing } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import NotificationsContent from './NotificationsContent';
import PriceAlertForm from '@/components/price-alerts/PriceAlertForm';
import PriceAlertsList from '@/components/price-alerts/PriceAlertsList';
import { cn } from '@/lib/utils';

type Tab = 'activity' | 'price-alerts';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'activity',     label: 'Activity',      icon: Bell },
  { id: 'price-alerts', label: 'Price Alerts',  icon: BellRing },
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
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 md:px-6">
        <div className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-gray-950">
        {activeTab === 'activity' ? (
          <NotificationsContent />
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl mx-auto w-full space-y-6">
            <PriceAlertForm />
            <PriceAlertsList />
          </div>
        )}
      </div>
    </div>
  );
}
