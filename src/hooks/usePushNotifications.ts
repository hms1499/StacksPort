'use client';

import { useState, useEffect } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { usePriceAlertStore } from '@/store/priceAlertStore';
import type { PushAlertEntry } from '@/lib/push-storage';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushPermission = 'default' | 'granted' | 'denied';

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const walletAddress = useWalletStore((s) => s.stxAddress);  // field is stxAddress, not address
  const alerts = usePriceAlertStore((s) => s.alerts);

  useEffect(() => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window);
    if ('Notification' in window) {
      setPermission(Notification.permission as PushPermission);
    }
  }, []);

  async function subscribe(): Promise<boolean> {
    if (!isSupported || !walletAddress) return false;

    const perm = await Notification.requestPermission();
    setPermission(perm as PushPermission);
    if (perm !== 'granted') return false;

    try {
      const keyRes = await fetch('/api/push/vapid-key');
      const { publicKey } = await keyRes.json() as { publicKey: string };

      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
      });

      const subJson = pushSub.toJSON() as {
        endpoint: string;
        keys: { auth: string; p256dh: string };
      };

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
      });

      return true;
    } catch {
      return false;
    }
  }

  return { permission, isSupported, subscribe };
}
