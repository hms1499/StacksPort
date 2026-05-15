"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const { data: tokens, isLoading, error, isValidating } = useBubblesData();
  const { ids: watchlistIds, size: watchlistCount } = useWatchlist();
  const { holdings } = useHoldings();
  const heldIds = useMemo(() => new Set(Object.keys(holdings)), [holdings]);
  const [search, setSearch] = useState(qParam);

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
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [tokens, scope, watchlistIds, search]);

  const handleBubbleClick = useCallback(
    (token: BubbleToken, x: number, y: number) => {
      setSelected((prev) =>
        prev?.token.id === token.id ? null : { token, x, y }
      );
    },
    []
  );

  const handleCloseTooltip = useCallback(() => setSelected(null), []);

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
          <SearchInput value={search} onChange={setSearch} placeholder="Search…" />
          <MetricToggle value={metric} onChange={setMetric} />
          <TimeframeToggle value={timeframe} onChange={setTimeframe} />
        </div>

        {tokens && tokens.length > 0 && (
          <ReloadProgressBar
            tokens={tokens}
            isRefreshing={isValidating}
          />
        )}
      </div>

      <div className="flex-1 relative bg-black">
        {isLoading && !tokens && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {error && !tokens && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Failed to load data. Retrying...
            </p>
          </div>
        )}

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
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {search.trim()
                ? `No tokens match "${search}".`
                : scope === "watchlist"
                ? "Your watchlist is empty. Tap the ⭐ on any bubble to add it."
                : "No Stacks ecosystem tokens available."}
            </p>
          </div>
        )}

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
