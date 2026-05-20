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
  const { filters, setTypeFilter, setCategoryFilter, setDateRangeFilter, clearFilters } = useNotificationStore();

  const hasActiveFilters =
    filters.types.length > 0 || filters.categories.length > 0 || filters.dateRange !== 'all';

  const handleTypeToggle = (type: NotificationType) => {
    setTypeFilter(filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type]);
  };

  const handleCategoryToggle = (category: NotificationCategory) => {
    setCategoryFilter(filters.categories.includes(category) ? filters.categories.filter((c) => c !== category) : [...filters.categories, category]);
  };

  const getTypeLabel = (type: NotificationType) => type.charAt(0).toUpperCase() + type.slice(1);

  const getCategoryLabel = (category: NotificationCategory) => {
    const labels: Record<NotificationCategory, string> = {
      dca: 'DCA In', 'dca-out': 'DCA Out', wallet: 'Wallet', swap: 'Swap', send: 'Send', price: 'Price Alert',
    };
    return labels[category];
  };

  const sidebarStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderRight: '1px solid var(--border-subtle)',
  };

  const content = (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Filters</h2>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={() => clearFilters()}
              className="text-xs font-medium transition-colors"
              style={{ color: 'var(--accent)' }}
            >
              Clear
            </button>
          )}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="lg:hidden transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close filters"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Type filters */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Type</h3>
        <div className="space-y-2">
          {typeOptions.map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.types.includes(type)}
                onChange={() => handleTypeToggle(type)}
                className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getTypeLabel(type)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Category filters */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Category</h3>
        <div className="space-y-2">
          {categoryOptions.map((category) => (
            <label key={category} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.categories.includes(category)}
                onChange={() => handleCategoryToggle(category)}
                className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getCategoryLabel(category)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date range filters */}
      <div>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Date Range</h3>
        <div className="space-y-2">
          {(['hour', 'day', 'week', 'all'] as const).map((range) => (
            <label key={range} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dateRange"
                value={range}
                checked={filters.dateRange === range}
                onChange={() => setDateRangeFilter(range)}
                className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {range === 'hour' ? 'Last hour' : range === 'day' ? 'Last day' : range === 'week' ? 'Last week' : 'All time'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
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
      <aside className="hidden lg:flex flex-col w-64 overflow-y-auto" style={sidebarStyle}>
        {content}
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onMobileClose} aria-hidden="true" />
          <aside
            className={cn('fixed inset-y-0 left-0 z-50 w-72 shadow-xl overflow-y-auto lg:hidden animate-in slide-in-from-left duration-200')}
            style={sidebarStyle}
          >
            {content}
          </aside>
        </>
      )}
    </>
  );
}
