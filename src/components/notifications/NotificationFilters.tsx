'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import type { NotificationType, NotificationCategory } from '@/types/notifications';
import { cn } from '@/lib/utils';

const typeOptions: NotificationType[] = ['success', 'error', 'warning', 'info'];
const categoryOptions: NotificationCategory[] = ['dca', 'dca-out', 'wallet', 'swap', 'send', 'price'];

interface NotificationFiltersProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function NotificationFilters({
  isMobileOpen = false,
  onMobileClose,
}: NotificationFiltersProps) {
  const {
    filters,
    setTypeFilter,
    setCategoryFilter,
    setDateRangeFilter,
    clearFilters,
  } = useNotificationStore();

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.categories.length > 0 ||
    filters.dateRange !== 'all';

  const handleTypeToggle = (type: NotificationType) => {
    setTypeFilter(
      filters.types.includes(type)
        ? filters.types.filter((t) => t !== type)
        : [...filters.types, type]
    );
  };

  const handleCategoryToggle = (category: NotificationCategory) => {
    setCategoryFilter(
      filters.categories.includes(category)
        ? filters.categories.filter((c) => c !== category)
        : [...filters.categories, category]
    );
  };

  const getTypeLabel = (type: NotificationType) =>
    type.charAt(0).toUpperCase() + type.slice(1);

  const getCategoryLabel = (category: NotificationCategory) => {
    const labels: Record<NotificationCategory, string> = {
      dca: 'DCA In',
      'dca-out': 'DCA Out',
      wallet: 'Wallet',
      swap: 'Swap',
      send: 'Send',
      price: 'Price Alert',
    };
    return labels[category];
  };

  const content = (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Filters</h2>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={() => clearFilters()}
              className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium transition-colors"
            >
              Clear
            </button>
          )}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Close filters"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Type filters */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Type</h3>
        <div className="space-y-2">
          {typeOptions.map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.types.includes(type)}
                onChange={() => handleTypeToggle(type)}
                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{getTypeLabel(type)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Category filters */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Category</h3>
        <div className="space-y-2">
          {categoryOptions.map((category) => (
            <label key={category} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.categories.includes(category)}
                onChange={() => handleCategoryToggle(category)}
                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{getCategoryLabel(category)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date range filters */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Date Range</h3>
        <div className="space-y-2">
          {(['hour', 'day', 'week', 'all'] as const).map((range) => (
            <label key={range} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dateRange"
                value={range}
                checked={filters.dateRange === range}
                onChange={() => setDateRangeFilter(range)}
                className="w-4 h-4 border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {range === 'hour'
                  ? 'Last hour'
                  : range === 'day'
                    ? 'Last day'
                    : range === 'week'
                      ? 'Last week'
                      : 'All time'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {filters.types.length + filters.categories.length} filter
            {filters.types.length + filters.categories.length !== 1 ? 's' : ''} applied
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
        {content}
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 shadow-xl overflow-y-auto lg:hidden',
              'animate-in slide-in-from-left duration-200'
            )}
          >
            {content}
          </aside>
        </>
      )}
    </>
  );
}
