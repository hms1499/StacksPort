"use client";

import useSWR from "swr";
import type { MarketSnapshot, FearGreed } from "@/lib/server/market-snapshot";
import type {
  TrendingToken,
  STXMarketStats,
  STXMarketHistory,
  PoxCycleInfo,
} from "@/lib/stacks";
import type { NewsItem } from "@/lib/server/news";

const SNAPSHOT_KEY = "market-snapshot";
const REFRESH_MS = 60_000;

async function fetchSnapshot(): Promise<MarketSnapshot> {
  const res = await fetch("/api/market/snapshot");
  if (!res.ok) throw new Error("market snapshot fetch failed");
  return res.json();
}

export function useMarketSnapshot() {
  return useSWR<MarketSnapshot>(SNAPSHOT_KEY, fetchSnapshot, {
    refreshInterval: REFRESH_MS,
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
  });
}

// Selectors — preserve the original hook return shape `{ data, isLoading, error }`
// so call sites don't need to change.
function selector<T>(pick: (s: MarketSnapshot) => T | null | undefined) {
  return () => {
    const { data, isLoading, error } = useMarketSnapshot();
    return {
      data: data ? (pick(data) ?? undefined) : undefined,
      isLoading,
      error,
    };
  };
}

export const useTrendingTokensSnap = selector<TrendingToken[]>((s) => s.trending);
export const useSTXMarketStatsSnap = selector<STXMarketStats>((s) => s.stxStats);
export const useSTXMarketHistorySnap = selector<STXMarketHistory>(
  (s) => s.stxHistory7d
);
export const usePoxCycleSnap = selector<PoxCycleInfo>((s) => s.pox);
export const useFearGreedSnap = selector<FearGreed>((s) => s.fearGreed);
export const useNewsSnap = selector<NewsItem[]>((s) => s.news);
export const useSwapPricesSnap = selector<Record<string, { usd: number }>>(
  (s) => s.swapPrices
);

export type { MarketSnapshot, FearGreed, NewsItem };
