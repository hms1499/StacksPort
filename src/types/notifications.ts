export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationCategory = 'dca' | 'dca-out' | 'wallet' | 'swap' | 'send' | 'price';

export interface NotificationContext {
  planId?: string;
  txId?: string;
  tokenSymbol?: string;
  amount?: string;
  action?: string; // 'created' | 'executed' | 'paused' | 'resumed' | 'cancelled'
}

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  timestamp: number; // unix ms
  context?: NotificationContext;
  duration?: number; // auto-dismiss ms, undefined = keep until dismissed manually
  isShown?: boolean; // false = Toast hidden but data still in store for Drawer/Page
  isRead?: boolean; // false/undefined = unread (counts toward badge)
}

export interface FilterState {
  types: NotificationType[];
  categories: NotificationCategory[];
  dateRange: 'hour' | 'day' | 'week' | 'all';
  searchQuery: string;
  sortBy: 'newest' | 'oldest';
}

export interface NotificationStoreState {
  notifications: Notification[];
  filters: FilterState;

  // Actions
  addNotification: (
    message: string,
    type: NotificationType,
    category: NotificationCategory,
    duration?: number,
    context?: NotificationContext
  ) => string; // returns notification id

  dismissNotification: (id: string) => void; // Remove from store (user click X)
  hideNotification: (id: string) => void; // Hide from Toast only (auto-dismiss timeout)
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;

  // Filters
  setTypeFilter: (types: NotificationType[]) => void;
  setCategoryFilter: (categories: NotificationCategory[]) => void;
  setDateRangeFilter: (range: 'hour' | 'day' | 'week' | 'all') => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: 'newest' | 'oldest') => void;
  clearFilters: () => void;

  // Computed
  getFilteredNotifications: () => Notification[];
  getUnreadCount: () => number;
}
