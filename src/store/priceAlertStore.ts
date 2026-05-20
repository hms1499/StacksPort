'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PriceAlert, PriceAlertCondition, PriceAlertStoreState } from '@/types/priceAlerts';
import type { PushAlertEntry } from '@/lib/push-redis';

const generateId = () => `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Debounce timer cho syncAlerts — tránh gửi nhiều request liên tiếp khi user
// toggle/add/remove nhiều alert nhanh (ví dụ: batch edit). Gộp thành 1 request duy nhất.
let syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 500;

async function syncAlerts(walletAddress: string, alerts: PriceAlert[]) {
  if (!walletAddress || Notification.permission !== 'granted') return;

  // Huỷ request cũ chưa kịp gửi, lên lịch lại từ đầu
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(async () => {
    syncTimer = null;

    let sub: PushSubscription | null = null;
    try {
      const reg = await navigator.serviceWorker.ready;
      sub = await reg.pushManager.getSubscription();
    } catch {
      return;
    }
    if (!sub) return;

    const subJson = sub.toJSON() as { endpoint: string; keys: { auth: string; p256dh: string } };
    const pushAlerts: PushAlertEntry[] = alerts
      .filter((a) => a.isActive)
      .map((a) => ({
        id: a.id,
        tokenSymbol: a.tokenSymbol,
        geckoId: a.geckoId,
        condition: a.condition,
        targetPrice: a.targetPrice,
        isActive: a.isActive,
        lastPushedAt: null,
      }));

    await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, subscription: subJson, alerts: pushAlerts }),
    }).catch(() => {});
  }, SYNC_DEBOUNCE_MS);
}

export const usePriceAlertStore = create<PriceAlertStoreState>()(
  persist(
    (set, get) => ({
      alerts: [],
      walletAddress: '',

      setWalletAddress: (addr: string) => set({ walletAddress: addr }),

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
        syncAlerts(get().walletAddress, get().alerts);
      },

      removeAlert: (id: string) => {
        set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }));
        syncAlerts(get().walletAddress, get().alerts);
      },

      toggleAlert: (id: string) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, isActive: !a.isActive } : a
          ),
        }));
        syncAlerts(get().walletAddress, get().alerts);
      },

      markTriggered: (id: string) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, isActive: false, triggeredAt: Date.now() } : a
          ),
        }));
        syncAlerts(get().walletAddress, get().alerts);
      },

      resetAlert: (id: string) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, isActive: true, triggeredAt: undefined } : a
          ),
        }));
        syncAlerts(get().walletAddress, get().alerts);
      },
    }),
    { name: 'price-alerts-storage' }
  )
);
