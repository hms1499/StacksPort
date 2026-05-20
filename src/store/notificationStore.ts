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
          isShown: duration ? true : false,
        };

        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50), // max 50
        }));

        // Auto-dismiss được xử lý bởi CSS animation onAnimationEnd trong Toast component.
        // Store không cần setTimeout nữa — tránh race condition giữa timer và user dismiss.

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

      // getFilteredNotifications đã bị xóa — NotificationsContent dùng useMemo riêng
      // để tránh tạo array mới mỗi lần store update.
      // getUnreadCount đã bị xóa — dùng Zustand selector trực tiếp ở component:
      //   useNotificationStore((s) => s.notifications.filter((n) => !n.isRead).length)
      // Zustand so sánh primitive (number) → chỉ re-render khi count thực sự thay đổi.
    }),
    {
      name: 'notifications-storage',
      // Chỉ persist notifications, không persist filters (ephemeral UI state)
      partialize: (state) => ({ notifications: state.notifications }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // TTL: xóa notification cũ hơn 7 ngày để tránh localStorage phình to.
        // Người dùng không cần lịch sử quá 1 tuần cho DCA/swap events.
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - ONE_WEEK_MS;

        state.notifications = state.notifications
          .filter((n) => n.timestamp > cutoff)
          // Reset isShown sau reload: toast đã hiện rồi, không hiện lại
          .map((n) => ({ ...n, isShown: false }));
      },
    }
  )
);
