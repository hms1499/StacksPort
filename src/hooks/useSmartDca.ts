"use client";
import useSWR from "swr";
import { useEffect } from "react";
import { useSmartDcaStore } from "@/store/smartDcaStore";
import type { SmartDcaConfigView } from "@/lib/smart-dca-redis";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Hydrate the store from the server for a connected wallet.
export function useSmartDcaHydration(address: string | null) {
  const setAll = useSmartDcaStore((s) => s.setAll);
  const { data } = useSWR<{ configs: SmartDcaConfigView[] }>(
    address ? `/api/dca/smart?address=${address}` : null,
    fetcher,
    { refreshInterval: 30_000 }
  );
  useEffect(() => {
    if (data?.configs) setAll(data.configs);
  }, [data, setAll]);
}

export async function saveSmartDca(input: {
  address: string; planId: number; thresholdBps: number; windowDays: number; maxDeferIntervals: number;
}): Promise<{ ok: boolean; details?: string[] }> {
  const res = await fetch("/api/dca/smart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (res.ok) {
    useSmartDcaStore.getState().upsert(json.config);
    return { ok: true };
  }
  return { ok: false, details: json.details };
}

export async function removeSmartDca(address: string, planId: number): Promise<void> {
  const res = await fetch("/api/dca/smart", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, planId }),
  });
  if (res.ok) useSmartDcaStore.getState().remove(planId);
}

// Live signal for the status line.
export function useSmartDcaSignal(windowDays: number, enabled: boolean) {
  const { data } = useSWR<{ signal: { current: number; sma: number; premium: number | null } | null }>(
    enabled ? `/api/dca/smart/signal?windowDays=${windowDays}` : null,
    fetcher,
    { refreshInterval: 60_000 }
  );
  return data?.signal ?? null;
}
