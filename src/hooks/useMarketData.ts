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
  getTokensWithValues,
  getPnLData,
  type PortfolioValue,
  type TrendingToken,
  type STXMarketStats,
  type STXMarketHistory,
  type ConnectedAppsResult,
  type PnLData,
  type TokenWithValue,
} from "@/lib/stacks";
import { getUserPlans, type DCAPlan } from "@/lib/dca";
import { SWAP_PRICE_GECKO_IDS, SWAP_TOKEN_USD } from "@/lib/direct-swap";

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

// ─── Swap token USD prices ────────────────────────────────────────────────────
// CoinGecko simple/price shape: { [geckoId]: { usd: number } }. Only the gecko
// ids the swap tokens need (see SWAP_PRICE_GECKO_IDS) are requested.
async function fetchSwapPrices(): Promise<Record<string, { usd: number }>> {
  const ids = SWAP_PRICE_GECKO_IDS.join(",");
  const res = await fetch(
    `/api/coingecko/simple/price?ids=${ids}&vs_currencies=usd`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error("Swap price fetch failed");
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

export function useSwapPrices() {
  return useSWR<Record<string, { usd: number }>>(
    "swap-prices",
    fetchSwapPrices,
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

export function useTokensWithValues(address: string | undefined) {
  return useSWR<{ stx: TokenWithValue; tokens: TokenWithValue[]; totalUsd: number }>(
    address ? ["tokens-with-values", address] : null,
    () => getTokensWithValues(address!),
    { refreshInterval: 60_000, dedupingInterval: 30_000 }
  );
}

export function usePnLData(address: string | undefined) {
  return useSWR<PnLData>(
    address ? ["pnl-data", address] : null,
    () => getPnLData(address!),
    { refreshInterval: 300_000, dedupingInterval: 60_000 }
  );
}

export function useUserDCAPlans(address: string | undefined) {
  return useSWR<DCAPlan[]>(
    address ? ["dca-plans", address] : null,
    () => getUserPlans(address!),
    { refreshInterval: 120_000, dedupingInterval: 60_000 }
  );
}

// ─── Swap pair price history (for sparkline chart) ───────────────────────────
// Fetches 7-day daily USD price arrays for two tokens via the CoinGecko proxy.
// Stablecoins (geckoId = null) get a synthetic flat series so pairRateSeries
// doesn't need special-casing.

async function fetchGeckoPrices(geckoId: string): Promise<number[]> {
  const res = await fetch(
    `/api/coingecko/coins/${geckoId}/market_chart?vs_currency=usd&days=7&interval=daily`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`CoinGecko fetch failed for ${geckoId}`);
  const json: { prices: [number, number][] } = await res.json();
  return json.prices.map(([, price]) => price);
}

async function fetchPairUsdSeries(
  fromId: string,
  toId: string
): Promise<[number[], number[]]> {
  const fromSrc = SWAP_TOKEN_USD[fromId];
  const toSrc = SWAP_TOKEN_USD[toId];
  if (!fromSrc || !toSrc) return [[], []];

  const [fromArr, toArr] = await Promise.all([
    fromSrc.geckoId ? fetchGeckoPrices(fromSrc.geckoId) : Promise.resolve(null),
    toSrc.geckoId ? fetchGeckoPrices(toSrc.geckoId) : Promise.resolve(null),
  ]);

  // Build flat stablecoin series aligned to the real fetch length (or 8 points)
  const refLen = (fromArr ?? toArr)?.length ?? 8;
  const fromUsd = fromArr ?? Array(refLen).fill(fromSrc.fixedUsd ?? 1);
  const toUsd = toArr ?? Array(refLen).fill(toSrc.fixedUsd ?? 1);
  return [fromUsd, toUsd];
}

export function usePairPriceHistory(
  fromId: string | null,
  toId: string | null
) {
  return useSWR<[number[], number[]]>(
    fromId && toId ? ["pair-price-history", fromId, toId] : null,
    () => fetchPairUsdSeries(fromId!, toId!),
    { refreshInterval: SLOW_REFRESH, dedupingInterval: 60_000 }
  );
}

export type { FearGreedData, NewsItem };
