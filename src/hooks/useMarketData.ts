"use client";

import useSWR from "swr";
import {
  getPortfolioHistory,
  getSTXPriceHistory,
  getTokenMetadata,
  getConnectedApps,
  fetchContractInfo,
  type PortfolioValue,
  type ConnectedAppsResult,
  type KnownProtocol,
} from "@/lib/stacks";
import { SWAP_TOKEN_USD } from "@/lib/direct-swap";
import {
  fetchAllPositions,
  type ProtocolPosition,
} from "@/lib/protocol-positions";
import {
  useTrendingTokensSnap,
  useSTXMarketStatsSnap,
  useSTXMarketHistorySnap,
  usePoxCycleSnap,
  useFearGreedSnap,
  useNewsSnap,
  useSwapPricesSnap,
  type FearGreed,
} from "@/hooks/useMarketSnapshot";
import {
  usePortfolioSnap,
  useFungibleTokensSnap,
  useTokensWithValuesSnap,
  useUserDCAPlansSnap,
  usePnLDataSnap,
  useTransactionsSnap,
} from "@/hooks/usePortfolioSnapshot";
import type { NewsItem } from "@/lib/server/news";

// ─── SWR config defaults ──────────────────────────────────────────────────────
const SLOW_REFRESH = 120_000; // 2 min — market data
const FAST_REFRESH = 60_000;  // 1 min — portfolio/balance

// Fear & Greed / News / Swap prices are now sourced from the market snapshot
// endpoint via useMarketSnapshot selectors (see below). Type aliases kept for
// backwards-compatible re-export at the bottom of this file.
type FearGreedData = FearGreed;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const usePortfolio = usePortfolioSnap;

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

// These hooks now share a single backing fetch via the market snapshot.
// Components keep the original API: `{ data, isLoading, error }`.
export const useTrendingTokens = useTrendingTokensSnap;
export const useSTXMarketStats = useSTXMarketStatsSnap;

// Snapshot fixes the window at 7d. Callers today all pass 7; the parameter is
// kept for signature compat and is ignored.
export function useSTXMarketHistory(_days = 7) {
  return useSTXMarketHistorySnap();
}

export const usePoxCycle = usePoxCycleSnap;
export const useFearGreed = useFearGreedSnap;
export const useNews = useNewsSnap;

export const useTransactions = useTransactionsSnap;

export const useSwapPrices = useSwapPricesSnap;

export const useFungibleTokens = useFungibleTokensSnap;

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

export const useTokensWithValues = useTokensWithValuesSnap;
export const usePnLData = usePnLDataSnap;
export const useUserDCAPlans = useUserDCAPlansSnap;

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

// ─── Protocol positions (value at stake per DeFi protocol) ───────────────────

export function useProtocolPositions(
  address: string | undefined,
  protocols: KnownProtocol[]
) {
  return useSWR<Map<string, ProtocolPosition | null>>(
    address && protocols.length > 0 ? ["protocol-positions", address] : null,
    () => fetchAllPositions(address!, protocols),
    { refreshInterval: 120_000, dedupingInterval: 60_000 }
  );
}

// ─── Contract info (source code verification status) ─────────────────────────

export function useContractInfo(contractId: string | undefined) {
  return useSWR<{ sourceVerified: boolean }>(
    contractId ? ["contract-info", contractId] : null,
    () => fetchContractInfo(contractId!),
    { dedupingInterval: 300_000 }
  );
}
