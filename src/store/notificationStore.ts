'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Notification,
  NotificationStoreState,
  NotificationType,
  NotificationCategory,
  NotificationContext,
} from '@/types/notifications';

// Helper to generate unique IDs
const generateId = () => `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper to check if notification falls within date range
const isWithinDateRange = (timestamp: number, range: 'hour' | 'day' | 'week' | 'all'): boolean => {
  const now = Date.now();
  const diff = now - timestamp;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const oneWeek = 7 * oneDay;

  switch (range) {
    case 'hour':
      return diff <= oneHour;
    case 'day':
      return diff <= oneDay;
    case 'week':
      return diff <= oneWeek;
    case 'all':
      return true;
    default:
      return true;
  }
};

export const useNotificationStore = create<NotificationStoreState>()(
  persist(
    (set, get) => ({
      notifications: [],
      filters: {
        types: [],
        categories: [],
        dateRange: 'all',
        searchQuery: '',
        sortBy: 'newest',
      },

      addNotification: (
        message: string,
        type: NotificationType,
        category: NotificationCategory,
        duration?: number,
        context?: NotificationContext
      ): string => {
        const id = generateId();
        const timestamp = Date.now();

        const notification: Notification = {
          id,
          message,
          type,
          category,
          timestamp,
          context,
          duration,
          isRead: false,
        };

        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50), // max 50
        }));

        // Hide Toast (auto-dismiss) if duration specified, but keep in store
        if (duration && duration > 0) {
          setTimeout(() => {
            get().hideNotification(id);
          }, duration);
        }

        return id;
      },

      dismissNotification: (id: string): void => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      hideNotification: (id: string): void => {
        // Hide Toast but keep notification in store for Drawer/Page
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isShown: false } : n
          ),
        }));
      },

      markAsRead: (id: string): void => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        }));
      },

      markAllAsRead: (): void => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        }));
      },

      clearAll: (): void => {
        set({ notifications: [] });
      },

      setTypeFilter: (types: NotificationType[]): void => {
        set((state) => ({
          filters: { ...state.filters, types },
        }));
      },

      setCategoryFilter: (categories: NotificationCategory[]): void => {
        set((state) => ({
          filters: { ...state.filters, categories },
        }));
      },

      setDateRangeFilter: (range: 'hour' | 'day' | 'week' | 'all'): void => {
        set((state) => ({
          filters: { ...state.filters, dateRange: range },
        }));
      },

      setSearchQuery: (query: string): void => {
        set((state) => ({
          filters: { ...state.filters, searchQuery: query.toLowerCase() },
        }));
      },

      setSortBy: (sort: 'newest' | 'oldest'): void => {
        set((state) => ({
          filters: { ...state.filters, sortBy: sort },
        }));
      },

      clearFilters: (): void => {
        set((state) => ({
          filters: {
            ...state.filters,
            types: [],
            categories: [],
            dateRange: 'all',
            searchQuery: '',
            sortBy: 'newest',
          },
        }));
      },

      getFilteredNotifications: (): Notification[] => {
        const state = get();
        let filtered = [...state.notifications];

        if (state.filters.types.length > 0) {
          filtered = filtered.filter((n) => state.filters.types.includes(n.type));
        }

        if (state.filters.categories.length > 0) {
          filtered = filtered.filter((n) => state.filters.categories.includes(n.category));
        }

        filtered = filtered.filter((n) => isWithinDateRange(n.timestamp, state.filters.dateRange));

        if (state.filters.searchQuery) {
          filtered = filtered.filter((n) =>
            n.message.toLowerCase().includes(state.filters.searchQuery)
          );
        }

        if (state.filters.sortBy === 'oldest') {
          filtered = filtered.reverse();
        }

        return filtered;
      },

      getUnreadCount: (): number => {
        return get().notifications.filter((n) => !n.isRead).length;
      },
    }),
    {
      name: 'notifications-storage',
      // Chỉ persist notifications, không persist filters (ephemeral)
      partialize: (state) => ({ notifications: state.notifications }),
      // Khi hydrate, reset isShown để toast không hiện lại sau reload
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.notifications = state.notifications.map((n) => ({
            ...n,
            isShown: false,
          }));
        }
      },
    }
  )
);
