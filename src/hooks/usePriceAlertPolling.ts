'use client';

import { useEffect, useRef } from 'react';
import { usePriceAlertStore } from '@/store/priceAlertStore';
import { useNotificationStore } from '@/store/notificationStore';

const POLL_INTERVAL_MS = 60_000; // 60 seconds

async function fetchPrices(geckoIds: string[]): Promise<Record<string, number>> {
  if (geckoIds.length === 0) return {};
  try {
    const ids = [...new Set(geckoIds)].join(',');
    const res = await fetch(
      `/api/coingecko/simple/price?ids=${ids}&vs_currencies=usd`,
      { cache: 'no-store' }
    );
    if (!res.ok) return {};
    const data = await res.json();
    // data: { [geckoId]: { usd: number } }
    const prices: Record<string, number> = {};
    for (const [id, val] of Object.entries(data as Record<string, { usd: number }>)) {
      prices[id] = val.usd ?? 0;
    }
    return prices;
  } catch {
    return {};
  }
}

export function usePriceAlertPolling() {
  const { alerts, markTriggered } = usePriceAlertStore();
  const { addNotification } = useNotificationStore();

  // Use ref so the interval callback always has latest state without re-subscribing
  const alertsRef = useRef(alerts);
  const markTriggeredRef = useRef(markTriggered);
  const addNotificationRef = useRef(addNotification);

  useEffect(() => { alertsRef.current = alerts; }, [alerts]);
  useEffect(() => { markTriggeredRef.current = markTriggered; }, [markTriggered]);
  useEffect(() => { addNotificationRef.current = addNotification; }, [addNotification]);

  useEffect(() => {
    const check = async () => {
      const activeAlerts = alertsRef.current.filter((a) => a.isActive);
      if (activeAlerts.length === 0) return;

      const geckoIds = activeAlerts.map((a) => a.geckoId);
      const prices = await fetchPrices(geckoIds);

      for (const alert of activeAlerts) {
        const currentPrice = prices[alert.geckoId];
        if (currentPrice == null || currentPrice === 0) continue;

        const triggered =
          alert.condition === 'above'
            ? currentPrice >= alert.targetPrice
            : currentPrice <= alert.targetPrice;

        if (triggered) {
          const conditionLabel = alert.condition === 'above' ? 'above' : 'below';
          addNotificationRef.current(
            `${alert.tokenSymbol} is ${conditionLabel} $${alert.targetPrice.toLocaleString()} — current price: $${currentPrice.toLocaleString()}`,
            'info',
            'price',
            undefined, // no auto-dismiss, keep in store permanently
            { tokenSymbol: alert.tokenSymbol, amount: currentPrice.toString(), action: conditionLabel }
          );
          markTriggeredRef.current(alert.id);
        }
      }
    };

    // Run immediately on mount, then every 60s
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // empty deps — uses refs
}
