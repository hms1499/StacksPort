"use client";

import useSWR from "swr";
import {
  getPortfolioValue,
  getPortfolioHistory,
  getSTXPriceHistory,
  getTrendingTokens,
  getSTXMarketStats,
  getSTXMarketHistory,
  getTransactions,
  getFungibleTokens,
  getTokenMetadata,
  getConnectedApps,
  type PortfolioValue,
  type TrendingToken,
  type STXMarketStats,
  type STXMarketHistory,
  type ConnectedAppsResult,
} from "@/lib/stacks";

// ─── SWR config defaults ──────────────────────────────────────────────────────
const SLOW_REFRESH = 120_000; // 2 min — market data
const FAST_REFRESH = 60_000;  // 1 min — portfolio/balance

// ─── Fear & Greed Index ───────────────────────────────────────────────────────
interface FearGreedData {
  value: number;
  classification: string;
}

async function fetchFearGreed(): Promise<FearGreedData | null> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1", {
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json();
  const d = json.data?.[0];
  return d ? { value: Number(d.value), classification: d.value_classification } : null;
}

// ─── News ─────────────────────────────────────────────────────────────────────
interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
}

async function fetchNews(): Promise<NewsItem[]> {
  const res = await fetch("/api/news");
  return res.json();
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePortfolio(address: string | undefined) {
  return useSWR<PortfolioValue>(
    address ? ["portfolio", address] : null,
    () => getPortfolioValue(address!),
    { refreshInterval: FAST_REFRESH, dedupingInterval: 30_000 }
  );
}

export function usePortfolioHistory(
  address: string | undefined,
  portfolio: PortfolioValue | null | undefined,
  days: number
) {
  return useSWR<{ date: string; value: number }[]>(
    address && portfolio ? ["portfolio-history", address, days] : null,
    () => getPortfolioHistory(address!, portfolio!, days),
    { refreshInterval: SLOW_REFRESH, dedupingInterval: 30_000 }
  );
}

export function useSTXPriceHistory(days: number, enabled = true) {
  return useSWR<{ date: string; value: number }[]>(
    enabled ? ["stx-price-history", days] : null,
    () => getSTXPriceHistory(days),
    { refreshInterval: SLOW_REFRESH, dedupingInterval: 30_000 }
  );
}

export function useTrendingTokens() {
  return useSWR<TrendingToken[]>(
    "trending-tokens",
    getTrendingTokens,
    { refreshInterval: SLOW_REFRESH, dedupingInterval: 60_000 }
  );
}

export function useSTXMarketStats() {
  return useSWR<STXMarketStats>(
    "stx-market-stats",
    getSTXMarketStats,
    { refreshInterval: SLOW_REFRESH, dedupingInterval: 60_000 }
  );
}

export function useSTXMarketHistory(days = 7) {
  return useSWR<STXMarketHistory>(
    ["stx-market-history", days],
    () => getSTXMarketHistory(days),
    { refreshInterval: SLOW_REFRESH, dedupingInterval: 60_000 }
  );
}

export function useFearGreed() {
  return useSWR<FearGreedData | null>(
    "fear-greed",
    fetchFearGreed,
    { refreshInterval: SLOW_REFRESH, dedupingInterval: 60_000 }
  );
}

export function useNews() {
  return useSWR<NewsItem[]>(
    "news",
    fetchNews,
    { refreshInterval: SLOW_REFRESH, dedupingInterval: 60_000 }
  );
}

export function useTransactions(address: string | undefined, limit = 8) {
  return useSWR(
    address ? ["transactions", address, limit] : null,
    () => getTransactions(address!, limit),
    { refreshInterval: FAST_REFRESH, dedupingInterval: 30_000 }
  );
}

export function useFungibleTokens(address: string | undefined) {
  return useSWR(
    address ? ["fungible-tokens", address] : null,
    () => getFungibleTokens(address!),
    { refreshInterval: FAST_REFRESH, dedupingInterval: 30_000 }
  );
}

export function useTokenMetadata(contractId: string | undefined) {
  return useSWR(
    contractId ? ["token-metadata", contractId] : null,
    () => getTokenMetadata(contractId!),
    { dedupingInterval: 300_000 } // token metadata rarely changes
  );
}

export function useConnectedApps(address: string | undefined) {
  return useSWR<ConnectedAppsResult>(
    address ? ["connected-apps", address] : null,
    () => getConnectedApps(address!),
    { refreshInterval: 300_000, dedupingInterval: 60_000 }
  );
}

export type { FearGreedData, NewsItem };
