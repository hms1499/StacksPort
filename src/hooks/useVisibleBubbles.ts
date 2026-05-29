"use client";

import { useMemo } from "react";
import type { BubbleToken } from "@/hooks/useBubblesData";
import { changeForTimeframe } from "@/lib/bubbles";
import type { Timeframe } from "@/components/bubbles/TimeframeToggle";
import type { Scope } from "@/components/bubbles/ScopeToggle";
import type { BubbleFilters } from "@/components/bubbles/FilterMenu";

const STABLECOIN_IDS = new Set([
  "tether",
  "usd-coin",
  "dai",
  "first-digital-usd",
  "true-usd",
  "paxos-standard",
  "frax",
  "ethena-usde",
  "usdd",
  "binance-usd",
  "gemini-dollar",
  "liquity-usd",
  "blackrock-usd-institutional-digital-liquidity-fund",
  "hermetica-usdh",
]);

type Args = {
  tokens: BubbleToken[] | undefined;
  scope: Scope;
  watchlistIds: Set<string>;
  heldIds: Set<string>;
  filters: BubbleFilters;
  timeframe: Timeframe;
  search: string;
};

/**
 * The bubbles filter/sort pipeline: scope → market-cap/stablecoin filters →
 * sort → topN → movers threshold → text search. Returns the same reference
 * passed in when `tokens` is nullish so callers can keep their loading checks.
 */
export function useVisibleBubbles({
  tokens,
  scope,
  watchlistIds,
  heldIds,
  filters,
  timeframe,
  search,
}: Args): BubbleToken[] | undefined {
  return useMemo(() => {
    if (!tokens) return tokens;
    let filtered = tokens;
    if (scope === "stacks") filtered = filtered.filter((t) => t.isStacks);
    else if (scope === "watchlist")
      filtered = filtered.filter((t) => watchlistIds.has(t.id));
    else if (scope === "holdings")
      filtered = filtered.filter((t) => heldIds.has(t.id));
    if (filters.minMarketCap > 0) {
      filtered = filtered.filter((t) => t.marketCap >= filters.minMarketCap);
    }
    if (filters.excludeStables) {
      filtered = filtered.filter((t) => !STABLECOIN_IDS.has(t.id));
    }
    const getC = (t: BubbleToken) => changeForTimeframe(t, timeframe);
    const sorted = [...filtered];
    if (filters.sortBy === "volume") sorted.sort((a, b) => b.volume24h - a.volume24h);
    else if (filters.sortBy === "gainers") sorted.sort((a, b) => getC(b) - getC(a));
    else if (filters.sortBy === "losers") sorted.sort((a, b) => getC(a) - getC(b));
    else if (filters.sortBy === "name")
      sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
    else sorted.sort((a, b) => b.marketCap - a.marketCap);
    filtered = sorted;
    if (filters.topN > 0) {
      filtered = filtered.slice(0, filters.topN);
    }
    if (filters.moversThreshold > 0) {
      const th = filters.moversThreshold;
      filtered = filtered.filter((t) => Math.abs(getC(t)) >= th);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [tokens, scope, watchlistIds, heldIds, search, filters, timeframe]);
}
