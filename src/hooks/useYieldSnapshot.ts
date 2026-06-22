"use client";

import useSWR from "swr";
import type { YieldSnapshot } from "@/lib/server/yield-snapshot";

const SNAPSHOT_KEY = "yield-snapshot";
const REFRESH_MS = 600_000;

async function fetchSnapshot(): Promise<YieldSnapshot> {
  const res = await fetch("/api/yield/snapshot");
  if (!res.ok) throw new Error("yield snapshot fetch failed");
  return res.json();
}

export function useYieldSnapshot() {
  return useSWR<YieldSnapshot>(SNAPSHOT_KEY, fetchSnapshot, {
    refreshInterval: REFRESH_MS,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
}

export function useStackingApy() {
  const { data, isLoading, error } = useYieldSnapshot();
  return { data: data?.stackingApy ?? undefined, isLoading, error };
}

export function useZestApy(symbol: string | undefined) {
  const { data, isLoading, error } = useYieldSnapshot();
  const apy = symbol ? data?.zest?.[symbol.toUpperCase()] : undefined;
  return { data: apy, isLoading, error };
}

export type { YieldSnapshot };
