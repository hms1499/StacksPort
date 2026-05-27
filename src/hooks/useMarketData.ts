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

// Real recorded net-worth history (from /api/portfolio/history).
// Starts empty for new users — see firstSeenAt for the "Tracking since" copy.
export type PortfolioHistoryRange = "24h" | "7d" | "30d" | "all";

export interface PortfolioHistoryPoint {
  t: number;
  totalUsd: number;
  stxUsd: number;
  sbtcUsd: number;
}

export interface PortfolioHistoryResult {
  points: PortfolioHistoryPoint[];
  firstSeenAt: number | null;
}

async function fetchHistory(
  address: string,
  range: PortfolioHistoryRange
): Promise<PortfolioHistoryResult> {
  const res = await fetch(
    `/api/portfolio/history?address=${address}&range=${range}`
  );
  if (!res.ok) throw new Error(`history ${res.status}`);
  return res.json();
}

export function usePortfolioHistorySnap(
  address: string | undefined,
  range: PortfolioHistoryRange
) {
  return useSWR<PortfolioHistoryResult>(
    address ? ["portfolio-history-snap", address, range] : null,
    () => fetchHistory(address!, range),
    { refreshInterval: FAST_REFRESH, dedupingInterval: 30_000 }
  );
}

// Per-token CoinGecko price history. Used by the TokenDetailDrawer chart;
// caller is responsible for passing null geckoId when no chart should render.
async function fetchTokenPriceHistory(
  geckoId: string,
  days: number
): Promise<{ t: number; price: number }[]> {
  const interval = days === 1 ? "" : "&interval=daily";
  const res = await fetch(
    `/api/coingecko/coins/${geckoId}/market_chart?vs_currency=usd&days=${days}${interval}`
  );
  if (!res.ok) throw new Error(`token price history ${res.status}`);
  const data = (await res.json()) as { prices?: [number, number][] };
  return (data.prices ?? []).map(([t, price]) => ({ t, price }));
}

export function useTokenPriceHistory(geckoId: string | null, days: number) {
  return useSWR<{ t: number; price: number }[]>(
    geckoId ? ["token-price-history", geckoId, days] : null,
    () => fetchTokenPriceHistory(geckoId!, days),
    { refreshInterval: SLOW_REFRESH, dedupingInterval: 60_000 }
  );
}

// Per-token 24h stats from CoinGecko `/coins/{id}` — used in TokenDetailDrawer.
export interface TokenMarketStats {
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  marketCap: number | null;
}

async function fetchTokenMarketStats(geckoId: string): Promise<TokenMarketStats> {
  const params =
    "localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false";
  const res = await fetch(`/api/coingecko/coins/${geckoId}?${params}`);
  if (!res.ok) throw new Error(`token stats ${res.status}`);
  const json = (await res.json()) as {
    market_data?: {
      high_24h?: { usd?: number };
      low_24h?: { usd?: number };
      total_volume?: { usd?: number };
      market_cap?: { usd?: number };
    };
  };
  const m = json.market_data ?? {};
  return {
    high24h: m.high_24h?.usd ?? null,
    low24h: m.low_24h?.usd ?? null,
    volume24h: m.total_volume?.usd ?? null,
    marketCap: m.market_cap?.usd ?? null,
  };
}

export function useTokenMarketStats(geckoId: string | null) {
  return useSWR<TokenMarketStats>(
    geckoId ? ["token-market-stats", geckoId] : null,
    () => fetchTokenMarketStats(geckoId!),
    { refreshInterval: SLOW_REFRESH, dedupingInterval: 60_000 }
  );
}

// Per-token transactions filtered to those that moved this token.
async function fetchTokenTransactions(params: {
  address: string;
  contractId: string;
  decimals: number;
  symbol: string;
  limit: number;
}) {
  const q = new URLSearchParams({
    address: params.address,
    contractId: params.contractId,
    decimals: String(params.decimals),
    symbol: params.symbol,
    limit: String(params.limit),
  });
  const res = await fetch(`/api/portfolio/token-transactions?${q.toString()}`);
  if (!res.ok) throw new Error(`token tx ${res.status}`);
  return res.json() as Promise<{ results: TokenTxRow[] }>;
}

export interface TokenTxRow {
  txId: string;
  txType: string;
  status: "success" | "pending" | "failed";
  timestamp: number;
  direction: "in" | "out" | "neutral";
  amount: number | null;
  symbol: string;
  contractCall?: { contractId: string; functionName: string };
  counterpart?: string;
}

export function useTokenTransactions(
  address: string | undefined,
  contractId: string | undefined,
  opts: { decimals: number; symbol: string; limit?: number }
) {
  const enabled = !!address && !!contractId;
  return useSWR<{ results: TokenTxRow[] }>(
    enabled ? ["token-tx", address, contractId, opts.limit ?? 8] : null,
    () =>
      fetchTokenTransactions({
        address: address!,
        contractId: contractId!,
        decimals: opts.decimals,
        symbol: opts.symbol,
        limit: opts.limit ?? 8,
      }),
    { refreshInterval: FAST_REFRESH, dedupingInterval: 20_000 }
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
