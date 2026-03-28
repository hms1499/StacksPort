'use client';

import React, { useMemo, useState } from 'react';
import { Search, Trash2, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import NotificationFilters from './NotificationFilters';
import NotificationCard from './NotificationCard';
import { cn } from '@/lib/utils';
import type { Notification, NotificationCategory } from '@/types/notifications';

// --- Filter tabs ---
const TABS = [
  { key: 'all',          label: 'All',          categories: [] as NotificationCategory[] },
  { key: 'transactions', label: 'Transactions',  categories: ['swap', 'send'] as NotificationCategory[] },
  { key: 'alerts',       label: 'Alerts',        categories: ['price'] as NotificationCategory[] },
  { key: 'dca',          label: 'DCA',           categories: ['dca', 'dca-out'] as NotificationCategory[] },
  { key: 'wallet',       label: 'Wallet',        categories: ['wallet'] as NotificationCategory[] },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// --- Date grouping ---
function getDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const daysDiff = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });

  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const groups: { label: string; items: Notification[] }[] = [];
  const seen = new Map<string, Notification[]>();

  for (const n of notifications) {
    const label = getDateLabel(n.timestamp);
    if (!seen.has(label)) {
      const items: Notification[] = [];
      seen.set(label, items);
      groups.push({ label, items });
    }
    seen.get(label)!.push(n);
  }

  return groups;
}

export default function NotificationsContent() {
  const {
    notifications,
    filters,
    dismissNotification,
    setSearchQuery,
    setSortBy,
    getUnreadCount,
  } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const unreadCount = getUnreadCount();

  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications];

    // Tab filter (category)
    const tab = TABS.find((t) => t.key === activeTab);
    if (tab && tab.categories.length > 0) {
      filtered = filtered.filter((n) => (tab.categories as string[]).includes(n.category));
    }

    // Sidebar type filter
    if (filters.types.length > 0) {
      filtered = filtered.filter((n) => filters.types.includes(n.type));
    }

    // Sidebar date range filter
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    filtered = filtered.filter((n) => {
      const diff = now - n.timestamp;
      switch (filters.dateRange) {
        case 'hour': return diff <= oneHour;
        case 'day':  return diff <= oneHour * 24;
        case 'week': return diff <= oneHour * 24 * 7;
        default:     return true;
      }
    });

    // Search
    if (filters.searchQuery) {
      filtered = filtered.filter((n) =>
        n.message.toLowerCase().includes(filters.searchQuery)
      );
    }

    if (filters.sortBy === 'oldest') {
      filtered = filtered.reverse();
    }

    return filtered;
  }, [notifications, filters, activeTab]);

  const groups = useMemo(() => groupByDate(filteredNotifications), [filteredNotifications]);

  const handleSelectNotification = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    }
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach((id) => dismissNotification(id));
    setSelectedIds(new Set());
  };

  const activeFilterCount =
    filters.types.length + (filters.dateRange !== 'all' ? 1 : 0);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar filters (type + date range) */}
      <NotificationFilters
        isMobileOpen={isMobileFilterOpen}
        onMobileClose={() => setIsMobileFilterOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Filter tabs + unread badge */}
        <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 md:px-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeTab === tab.key
                      ? 'border-[#408A71] text-[#285A48] dark:text-[#B0E4CC]'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {unreadCount > 0 && (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#408A71] mr-1.5 align-middle" />
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>

        {/* Search and controls */}
        <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            {/* Filter button — mobile */}
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className={cn(
                'lg:hidden flex items-center gap-1.5 px-3 py-2 border rounded-lg transition-colors text-sm font-medium shrink-0',
                activeFilterCount > 0
                  ? 'border-[#408A71] text-[#285A48] bg-[#B0E4CC]/20'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-[#408A71] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#408A71] focus:border-transparent text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>

            {/* Sort */}
            <div className="relative ml-auto">
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Sort
                <ChevronDown size={15} />
              </button>

              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsSortOpen(false)} />
                  <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-40">
                    {(['newest', 'oldest'] as const).map((sort) => (
                      <button
                        key={sort}
                        onClick={() => { setSortBy(sort); setIsSortOpen(false); }}
                        className={cn(
                          'w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
                          filters.sortBy === sort && 'bg-[#B0E4CC]/20 dark:bg-[#285A48]/30 text-[#285A48] dark:text-[#B0E4CC] font-medium'
                        )}
                      >
                        {sort === 'newest' ? 'Newest first' : 'Oldest first'}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Bulk delete */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 size={15} />
                Delete ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Notifications list grouped by date */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-gray-300 mb-3">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">No notifications yet</p>
              <p className="text-gray-500 text-sm mt-1">Notifications will appear here as events occur</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Select all */}
              {filteredNotifications.length > 1 && (
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredNotifications.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-[#285A48] focus:ring-[#408A71]"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedIds.size === filteredNotifications.length
                      ? `Deselect all (${filteredNotifications.length})`
                      : `Select all (${filteredNotifications.length})`}
                  </span>
                </label>
              )}

              {/* Date groups */}
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">
                    {group.label}
                  </p>
                  <div className="space-y-3">
                    {group.items.map((notification) => (
                      <NotificationCard
                        key={notification.id}
                        notification={notification}
                        onDismiss={dismissNotification}
                        isSelected={selectedIds.has(notification.id)}
                        onSelect={handleSelectNotification}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
