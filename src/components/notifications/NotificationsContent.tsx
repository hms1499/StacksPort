'use client';

import React, { useMemo, useState } from 'react';
import { Search, Trash2, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import NotificationFilters from './NotificationFilters';
import NotificationCard from './NotificationCard';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/motion/EmptyState';
import { Bell } from 'lucide-react';
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
        <div style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="flex items-center justify-between px-4 md:px-6">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="px-3 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0"
                  style={{
                    borderBottomColor: activeTab === tab.key ? 'var(--accent)' : 'transparent',
                    color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {unreadCount > 0 && (
              <span className="text-xs font-medium shrink-0 pl-3" style={{ color: 'var(--text-muted)' }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: 'var(--accent)' }} />
                <span className="hidden sm:inline">{unreadCount} unread</span>
                <span className="sm:hidden">{unreadCount}</span>
              </span>
            )}
          </div>
        </div>

        {/* Search and controls */}
        <div className="px-4 py-3 md:px-6 space-y-2" style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
          {/* Row 1: Search (full width on mobile) */}
          <div className="flex items-center gap-2">
            {/* Filter button — mobile */}
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 border rounded-lg transition-colors text-sm font-medium shrink-0"
              style={{
                borderColor: activeFilterCount > 0 ? 'var(--accent)' : 'var(--border-default)',
                color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-secondary)',
                backgroundColor: activeFilterCount > 0 ? 'var(--accent-dim)' : 'transparent',
              }}
            >
              <SlidersHorizontal size={16} />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Search */}
            <div className="relative flex-1 md:max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search..."
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                style={{
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Sort + Bulk delete */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <div className="relative">
                <button
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                  style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  <span className="hidden sm:inline">Sort</span>
                  <ChevronDown size={15} />
                </button>

                {isSortOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsSortOpen(false)} />
                    <div className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg py-1 z-40" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                      {(['newest', 'oldest'] as const).map((sort) => (
                        <button
                          key={sort}
                          onClick={() => { setSortBy(sort); setIsSortOpen(false); }}
                          className="w-full text-left px-4 py-2 text-sm transition-colors"
                          style={{
                            backgroundColor: filters.sortBy === sort ? 'var(--accent-dim)' : 'transparent',
                            color: filters.sortBy === sort ? 'var(--accent)' : 'var(--text-secondary)',
                            fontWeight: filters.sortBy === sort ? 500 : 400,
                          }}
                        >
                          {sort === 'newest' ? 'Newest first' : 'Oldest first'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {selectedIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Trash2 size={15} />
                  <span className="hidden sm:inline">Delete ({selectedIds.size})</span>
                  <span className="sm:hidden">{selectedIds.size}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notifications list grouped by date */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {filteredNotifications.length === 0 ? (
            <EmptyState
              icon={<Bell size={28} style={{ color: 'var(--accent)' }} />}
              title="No notifications yet"
              description="Notifications will appear here when you make swaps, DCA executions, or hit price targets."
            />
          ) : (
            <div className="space-y-6">
              {/* Select all */}
              {filteredNotifications.length > 1 && (
                <label className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredNotifications.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {selectedIds.size === filteredNotifications.length
                      ? `Deselect all (${filteredNotifications.length})`
                      : `Select all (${filteredNotifications.length})`}
                  </span>
                </label>
              )}

              {/* Date groups */}
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--text-muted)' }}>
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
