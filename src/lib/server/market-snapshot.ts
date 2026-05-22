import {
  getTrendingTokens,
  getSTXMarketStats,
  getSTXMarketHistory,
  getPoxCycleInfo,
  type TrendingToken,
  type STXMarketStats,
  type STXMarketHistory,
  type PoxCycleInfo,
} from "@/lib/stacks";
import { SWAP_PRICE_GECKO_IDS } from "@/lib/direct-swap";
import { fetchNews, type NewsItem } from "@/lib/server/news";

export interface FearGreed {
  value: number;
  classification: string;
}

export interface MarketSnapshot {
  generatedAt: number;
  trending: TrendingToken[] | null;
  stxStats: STXMarketStats | null;
  stxHistory7d: STXMarketHistory | null;
  pox: PoxCycleInfo | null;
  fearGreed: FearGreed | null;
  news: NewsItem[];
  swapPrices: Record<string, { usd: number }>;
}

async function fetchFearGreed(): Promise<FearGreed | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json();
    const d = json.data?.[0];
    return d ? { value: Number(d.value), classification: d.value_classification } : null;
  } catch {
    return null;
  }
}

async function fetchSwapPrices(): Promise<Record<string, { usd: number }>> {
  try {
    const ids = SWAP_PRICE_GECKO_IDS.join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const [trending, stxStats, stxHistory7d, pox, fearGreed, news, swapPrices] =
    await Promise.all([
      safe(getTrendingTokens()),
      safe(getSTXMarketStats()),
      safe(getSTXMarketHistory(7)),
      safe(getPoxCycleInfo()),
      fetchFearGreed(),
      fetchNews(),
      fetchSwapPrices(),
    ]);

  return {
    generatedAt: Date.now(),
    trending,
    stxStats,
    stxHistory7d,
    pox,
    fearGreed,
    news,
    swapPrices,
  };
}
