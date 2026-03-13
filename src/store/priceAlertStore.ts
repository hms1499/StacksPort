'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PriceAlert, PriceAlertCondition, PriceAlertStoreState } from '@/types/priceAlerts';

const generateId = () => `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const usePriceAlertStore = create<PriceAlertStoreState>()(
  persist(
    (set) => ({
      alerts: [],

      addAlert: (
        tokenSymbol: string,
        geckoId: string,
        condition: PriceAlertCondition,
        targetPrice: number
      ) => {
        const alert: PriceAlert = {
          id: generateId(),
          tokenSymbol,
          geckoId,
          condition,
          targetPrice,
          isActive: true,
          createdAt: Date.now(),
        };
        set((state) => ({ alerts: [alert, ...state.alerts] }));
      },

      removeAlert: (id: string) => {
        set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }));
      },

      toggleAlert: (id: string) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, isActive: !a.isActive } : a
          ),
        }));
      },

      markTriggered: (id: string) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, isActive: false, triggeredAt: Date.now() } : a
          ),
        }));
      },

      resetAlert: (id: string) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, isActive: true, triggeredAt: undefined } : a
          ),
        }));
      },
    }),
    { name: 'price-alerts-storage' }
  )
);
