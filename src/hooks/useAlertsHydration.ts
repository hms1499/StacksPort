'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import { useWalletStore } from '@/store/walletStore';
import { usePriceAlertStore } from '@/store/priceAlertStore';
import type { PriceAlert } from '@/types/priceAlerts';
import type { AlertView } from '@/app/api/price-alerts/route';

// Hydrates the client price-alert store from the server's view in Redis.
// Server is the source of truth for isActive / triggeredAt / lastPushedAt
// (the keeper-bot evaluator owns those transitions). Without this, the
// local store could re-enable a fired alert after the server already
// deactivated it.

const REFRESH_MS = 30_000;

async function fetchAlerts(address: string): Promise<AlertView[]> {
  const res = await fetch(`/api/price-alerts?address=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error('alerts fetch failed');
  const data = (await res.json()) as { alerts: AlertView[] };
  return data.alerts ?? [];
}

function toLocalShape(server: AlertView[], local: PriceAlert[]): PriceAlert[] {
  // Preserve client-only fields (createdAt — server doesn't currently store it)
  // by merging with the existing local copy. New alerts from the server with
  // no local match get a synthetic createdAt of "now".
  const byId = new Map(local.map((a) => [a.id, a]));
  return server.map((s) => {
    const existing = byId.get(s.id);
    return {
      id: s.id,
      tokenSymbol: s.tokenSymbol,
      geckoId: s.geckoId,
      condition: s.condition,
      targetPrice: s.targetPrice,
      isActive: s.isActive,
      triggeredAt: s.triggeredAt,
      createdAt: existing?.createdAt ?? Date.now(),
    };
  });
}

export function useAlertsHydration(): void {
  const stxAddress = useWalletStore((s) => s.stxAddress);
  const setAlerts = usePriceAlertStore((s) => s.setAlerts);

  const { data } = useSWR(
    stxAddress ? ['price-alerts', stxAddress] : null,
    () => fetchAlerts(stxAddress!),
    {
      refreshInterval: REFRESH_MS,
      dedupingInterval: 10_000,
      revalidateOnFocus: true,
    }
  );

  useEffect(() => {
    if (!data) return;
    const local = usePriceAlertStore.getState().alerts;
    setAlerts(toLocalShape(data, local));
  }, [data, setAlerts]);
}
