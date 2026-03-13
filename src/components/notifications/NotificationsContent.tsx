'use client';

import React, { useMemo, useState } from 'react';
import { Search, Trash2, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import NotificationFilters from './NotificationFilters';
import NotificationCard from './NotificationCard';
import { cn } from '@/lib/utils';

export default function NotificationsContent() {
  const {
    notifications,
    filters,
    dismissNotification,
    setSearchQuery,
    setSortBy,
  } = useNotificationStore();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications];

    if (filters.types.length > 0) {
      filtered = filtered.filter((n) => filters.types.includes(n.type));
    }

    if (filters.categories.length > 0) {
      filtered = filtered.filter((n) => filters.categories.includes(n.category));
    }

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

    if (filters.searchQuery) {
      filtered = filtered.filter((n) =>
        n.message.toLowerCase().includes(filters.searchQuery)
      );
    }

    if (filters.sortBy === 'oldest') {
      filtered = filtered.reverse();
    }

    return filtered;
  }, [notifications, filters]);

  const handleSelectNotification = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
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

  const totalCount = notifications.length;
  const filteredCount = filteredNotifications.length;
  const hasFilters =
    filters.types.length > 0 ||
    filters.categories.length > 0 ||
    filters.dateRange !== 'all';

  const activeFilterCount = filters.types.length + filters.categories.length +
    (filters.dateRange !== 'all' ? 1 : 0);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Filters sidebar (desktop + mobile overlay) */}
      <NotificationFilters
        isMobileOpen={isMobileFilterOpen}
        onMobileClose={() => setIsMobileFilterOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search and controls */}
        <div className="border-b border-gray-100 bg-white p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              {/* Filter button — mobile only */}
              <button
                onClick={() => setIsMobileFilterOpen(true)}
                className={cn(
                  'lg:hidden flex items-center gap-1.5 px-3 py-2 border rounded-lg transition-colors text-sm font-medium shrink-0',
                  activeFilterCount > 0
                    ? 'border-teal-500 text-teal-600 bg-teal-50'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                )}
              >
                <SlidersHorizontal size={16} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-teal-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Search bar */}
              <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                >
                  Sort
                  <ChevronDown size={16} />
                </button>

                {isSortOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsSortOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-40">
                      {(['newest', 'oldest'] as const).map((sort) => (
                        <button
                          key={sort}
                          onClick={() => {
                            setSortBy(sort);
                            setIsSortOpen(false);
                          }}
                          className={cn(
                            'w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50',
                            filters.sortBy === sort && 'bg-teal-50 text-teal-600 font-medium'
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
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Trash2 size={16} />
                  Delete ({selectedIds.size})
                </button>
              )}
            </div>
          </div>

          {/* Filter info */}
          {hasFilters && (
            <p className="text-sm text-gray-600 mt-4">
              Showing {filteredCount} of {totalCount} notification
              {totalCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-gray-300 mb-3">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">
                {hasFilters ? 'No notifications match your filters' : 'No notifications yet'}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                {hasFilters
                  ? 'Try adjusting your filter criteria'
                  : 'Notifications will appear here as events occur'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Select all checkbox */}
              {filteredNotifications.length > 1 && (
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredNotifications.length && filteredNotifications.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedIds.size === filteredNotifications.length
                      ? `Deselect all (${filteredNotifications.length})`
                      : `Select all (${filteredNotifications.length})`}
                  </span>
                </label>
              )}

              {filteredNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onDismiss={dismissNotification}
                  isSelected={selectedIds.has(notification.id)}
                  onSelect={handleSelectNotification}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
