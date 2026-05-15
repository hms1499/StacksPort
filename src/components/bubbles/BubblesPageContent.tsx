"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useBubblesData } from "@/hooks/useBubblesData";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useHoldings } from "@/hooks/useHoldings";
import type { BubbleToken } from "@/hooks/useBubblesData";
import BubbleCanvas from "./BubbleCanvas";
import BubbleTooltip from "./BubbleTooltip";
import TimeframeToggle, { type Timeframe } from "./TimeframeToggle";
import ScopeToggle, { type Scope } from "./ScopeToggle";
import MetricToggle, { type Metric } from "./MetricToggle";
import SearchInput from "./SearchInput";
import ReloadProgressBar from "./ReloadProgressBar";
import ShortcutsHelp from "./ShortcutsHelp";
import ColorLegend from "./ColorLegend";
import BubblesSkeleton from "./BubblesSkeleton";
import FilterMenu, { DEFAULT_FILTERS, type BubbleFilters } from "./FilterMenu";

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

const VALID_TF: Timeframe[] = ["1h", "24h", "7d", "30d", "1y"];
const VALID_SCOPE: Scope[] = ["all", "stacks", "watchlist"];
const VALID_METRIC: Metric[] = ["change", "marketCap", "volume"];

export default function BubblesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tfParam = searchParams.get("tf") as Timeframe | null;
  const scopeParam = searchParams.get("scope") as Scope | null;
  const metricParam = searchParams.get("metric") as Metric | null;
  const qParam = searchParams.get("q") ?? "";
  const timeframe: Timeframe =
    tfParam && VALID_TF.includes(tfParam) ? tfParam : "24h";
  const scope: Scope =
    scopeParam && VALID_SCOPE.includes(scopeParam) ? scopeParam : "all";
  const metric: Metric =
    metricParam && VALID_METRIC.includes(metricParam) ? metricParam : "change";

  const updateParam = useCallback(
    (key: "tf" | "scope" | "metric", value: string, defaultValue: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === defaultValue) params.delete(key);
      else params.set(key, value);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const setTimeframe = useCallback(
    (tf: Timeframe) => updateParam("tf", tf, "24h"),
    [updateParam]
  );
  const setScope = useCallback(
    (s: Scope) => updateParam("scope", s, "all"),
    [updateParam]
  );
  const setMetric = useCallback(
    (m: Metric) => updateParam("metric", m, "change"),
    [updateParam]
  );

  const { data: tokens, isLoading, error, isValidating, mutate } = useBubblesData();
  const { ids: watchlistIds, size: watchlistCount } = useWatchlist();
  const { holdings } = useHoldings();
  const heldIds = useMemo(() => new Set(Object.keys(holdings)), [holdings]);
  const [search, setSearch] = useState(qParam);
  const [filters, setFilters] = useState<BubbleFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = search.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    const qs = params.toString();
    const current = searchParams.toString();
    if (qs === current) return;
    const t = setTimeout(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [search, router, pathname, searchParams]);
  const [selected, setSelected] = useState<{
    token: BubbleToken;
    x: number;
    y: number;
  } | null>(null);

  const stacksCount = useMemo(
    () => tokens?.filter((t) => t.isStacks).length ?? 0,
    [tokens]
  );

  const visibleTokens = useMemo(() => {
    if (!tokens) return tokens;
    let filtered = tokens;
    if (scope === "stacks") filtered = filtered.filter((t) => t.isStacks);
    else if (scope === "watchlist") filtered = filtered.filter((t) => watchlistIds.has(t.id));
    if (filters.minMarketCap > 0) {
      filtered = filtered.filter((t) => t.marketCap >= filters.minMarketCap);
    }
    if (filters.excludeStables) {
      filtered = filtered.filter((t) => !STABLECOIN_IDS.has(t.id));
    }
    if (filters.topN > 0) {
      filtered = [...filtered]
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, filters.topN);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [tokens, scope, watchlistIds, search, filters]);

  const handleBubbleClick = useCallback(
    (token: BubbleToken, x: number, y: number) => {
      setSelected((prev) =>
        prev?.token.id === token.id ? null : { token, x, y }
      );
    },
    []
  );

  const handleCloseTooltip = useCallback(() => setSelected(null), []);

  const searchRef = useRef<HTMLInputElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        if (isTyping) {
          (target as HTMLInputElement).blur();
          return;
        }
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        if (selected) {
          setSelected(null);
          return;
        }
        if (search) setSearch("");
        return;
      }

      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "?") {
        setShowHelp((v) => !v);
        return;
      }
      if (e.key === "1") setMetric("change");
      else if (e.key === "2") setMetric("marketCap");
      else if (e.key === "3") setMetric("volume");
      else if (e.key === "q") setTimeframe("1h");
      else if (e.key === "w") setTimeframe("24h");
      else if (e.key === "e") setTimeframe("7d");
      else if (e.key === "r") setTimeframe("30d");
      else if (e.key === "t") setTimeframe("1y");
      else if (e.key === "a") setScope("all");
      else if (e.key === "s") setScope("stacks");
      else if (e.key === "d") setScope("watchlist");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, search, showHelp, setMetric, setTimeframe, setScope]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h1
            className="text-base font-semibold shrink-0"
            style={{ color: "var(--text-primary)" }}
          >
            Crypto Bubbles
          </h1>
          <div className="flex-1 sm:flex-initial overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ScopeToggle
              value={scope}
              onChange={setScope}
              stacksCount={stacksCount}
              watchlistCount={watchlistCount}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-visible sm:flex-wrap sm:justify-end *:shrink-0">
          <SearchInput
            ref={searchRef}
            value={search}
            onChange={setSearch}
            placeholder="Search…  ( / )"
          />
          <MetricToggle value={metric} onChange={setMetric} />
          <TimeframeToggle value={timeframe} onChange={setTimeframe} />
          <FilterMenu value={filters} onChange={setFilters} />
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-mono hover:opacity-80"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
            }}
          >
            ?
          </button>
        </div>

        {tokens && tokens.length > 0 && (
          <ReloadProgressBar
            tokens={tokens}
            isRefreshing={isValidating}
          />
        )}
      </div>

      <div className="flex-1 relative bg-black">
        {isLoading && !tokens && <BubblesSkeleton />}

        {error && !tokens && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Failed to load data.
            </p>
            <button
              type="button"
              onClick={() => mutate()}
              className="text-xs px-3 py-1 rounded-md hover:opacity-80"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {visibleTokens && visibleTokens.length > 0 && <ColorLegend />}

        {visibleTokens && visibleTokens.length > 0 && (
          <BubbleCanvas
            tokens={visibleTokens}
            timeframe={timeframe}
            metric={metric}
            focusedId={selected?.token.id ?? null}
            heldIds={heldIds}
            onBubbleClick={handleBubbleClick}
          />
        )}

        {scope === "stacks" && visibleTokens && visibleTokens.length > 0 && (
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] px-2.5 py-1 rounded-full pointer-events-none"
            style={{
              backgroundColor: "rgba(0,0,0,0.55)",
              color: "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            Showing Stacks tokens with a CoinGecko price feed · DEX-only tokens not included
          </div>
        )}

        {visibleTokens && visibleTokens.length === 0 && tokens && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="text-3xl opacity-60">
              {search.trim() ? "🔎" : scope === "watchlist" ? "⭐" : "📭"}
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {search.trim()
                ? `No tokens match "${search}".`
                : scope === "watchlist"
                ? "Your watchlist is empty. Tap the ⭐ on any bubble to add it."
                : "No Stacks ecosystem tokens available."}
            </p>
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs px-3 py-1 rounded-md hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                Clear search
              </button>
            )}
            {!search.trim() && scope === "watchlist" && (
              <button
                type="button"
                onClick={() => setScope("all")}
                className="text-xs px-3 py-1 rounded-md hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                Browse all tokens
              </button>
            )}
          </div>
        )}

        {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}

        {selected && (
          <BubbleTooltip
            token={selected.token}
            x={selected.x}
            y={selected.y}
            timeframe={timeframe}
            onClose={handleCloseTooltip}
          />
        )}
      </div>

      {error && tokens && (
        <div
          className="px-4 py-1.5 text-center text-xs"
          style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)" }}
        >
          Data may be outdated
        </div>
      )}
    </div>
  );
}
