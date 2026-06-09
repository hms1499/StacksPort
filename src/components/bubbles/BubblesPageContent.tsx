"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useBubblesData } from "@/hooks/useBubblesData";
import { useVisibleBubbles } from "@/hooks/useVisibleBubbles";
import { useBubbleShortcuts } from "@/hooks/useBubbleShortcuts";
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
import FilterMenu, {
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  hasAnyFilterParam,
  type BubbleFilters,
} from "./FilterMenu";
import UpdatedAt from "./UpdatedAt";
import ActiveFilterChips from "./ActiveFilterChips";
import ToolbarMenu from "./ToolbarMenu";
import EdgeFadeScroller from "./EdgeFadeScroller";
import WatchlistBar from "./WatchlistBar";
import ViewToggle, { type View } from "./ViewToggle";
import BubbleList from "./BubbleList";

const VALID_TF: Timeframe[] = ["1h", "24h", "7d", "30d", "1y"];
const VALID_SCOPE: Scope[] = ["all", "stacks", "watchlist", "holdings"];
const VALID_METRIC: Metric[] = ["change", "marketCap", "volume"];
const VALID_VIEW: View[] = ["bubbles", "list"];

export default function BubblesPageContent() {
  const tr = useTranslations("bubbles");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tfParam = searchParams.get("tf") as Timeframe | null;
  const scopeParam = searchParams.get("scope") as Scope | null;
  const metricParam = searchParams.get("metric") as Metric | null;
  const viewParam = searchParams.get("view") as View | null;
  const qParam = searchParams.get("q") ?? "";
  const timeframe: Timeframe =
    tfParam && VALID_TF.includes(tfParam) ? tfParam : "24h";
  const scope: Scope =
    scopeParam && VALID_SCOPE.includes(scopeParam) ? scopeParam : "all";
  const metric: Metric =
    metricParam && VALID_METRIC.includes(metricParam) ? metricParam : "change";
  const view: View =
    viewParam && VALID_VIEW.includes(viewParam) ? viewParam : "bubbles";

  const updateParam = useCallback(
    (
      key: "tf" | "scope" | "metric" | "view",
      value: string,
      defaultValue: string
    ) => {
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
  const setView = useCallback(
    (v: View) => updateParam("view", v, "bubbles"),
    [updateParam]
  );

  const { data: tokens, isLoading, error, isValidating, mutate } = useBubblesData();
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (tokens && !isValidating) setUpdatedAt(Date.now());
  }, [tokens, isValidating]);
  const { ids: watchlistIds, size: watchlistCount } = useWatchlist();
  const { holdings, isConnected } = useHoldings();
  const heldIds = useMemo(() => new Set(Object.keys(holdings)), [holdings]);
  const [search, setSearch] = useState(qParam);
  const [filters, setFilters] = useState<BubbleFilters>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTERS;
    const urlParams = new URLSearchParams(window.location.search);
    if (hasAnyFilterParam(urlParams)) return filtersFromParams(urlParams);
    try {
      const raw = window.localStorage.getItem("bubbles:filters");
      if (!raw) return DEFAULT_FILTERS;
      return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("bubbles:filters", JSON.stringify(filters));
    } catch {
      // ignore
    }
  }, [filters]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    filtersToParams(params, filters);
    const qs = params.toString();
    if (qs === searchParams.toString()) return;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, router, pathname, searchParams]);

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
  const holdingsCount = useMemo(
    () => tokens?.filter((t) => heldIds.has(t.id)).length ?? 0,
    [tokens, heldIds]
  );

  const visibleTokens = useVisibleBubbles({
    tokens,
    scope,
    watchlistIds,
    heldIds,
    filters,
    timeframe,
    search,
  });

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
  const [isMobile, setIsMobile] = useState(false);
  const [paused, setPaused] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("bubbles:paused") === "1";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("bubbles:paused", paused ? "1" : "0");
    } catch {
      // ignore
    }
  }, [paused]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) setPaused(true);
    const update = (e: MediaQueryListEvent) => {
      if (e.matches) setPaused(true);
    };
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useBubbleShortcuts({
    searchRef,
    hasSelected: !!selected,
    search,
    showHelp,
    view,
    setMetric,
    setTimeframe,
    setScope,
    setView,
    setSearch,
    setShowHelp,
    setPaused,
    clearSelected: handleCloseTooltip,
    refresh: mutate,
  });

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h1
            className="text-base font-semibold shrink-0 flex items-baseline gap-1.5"
            style={{ color: "var(--text-primary)" }}
          >
            {tr("title")}
            {visibleTokens && (
              <span
                className="text-[11px] font-normal font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {visibleTokens.length}
              </span>
            )}
            <UpdatedAt timestamp={updatedAt} />
          </h1>
          <EdgeFadeScroller className="overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:contents">
            <ScopeToggle
              value={scope}
              onChange={setScope}
              stacksCount={stacksCount}
              watchlistCount={watchlistCount}
              holdingsCount={holdingsCount}
            />
          </EdgeFadeScroller>
        </div>
        <div className="flex items-center gap-2 min-w-0 sm:flex-wrap sm:justify-end">
          <EdgeFadeScroller className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:contents *:shrink-0">
            <SearchInput
              ref={searchRef}
              value={search}
              onChange={setSearch}
              placeholder={isMobile ? tr("searchShort") : tr("searchHint")}
            />
            <ViewToggle value={view} onChange={setView} />
            <MetricToggle value={metric} onChange={setMetric} />
            <TimeframeToggle value={timeframe} onChange={setTimeframe} />
          </EdgeFadeScroller>
          {/* Pop-over triggers stay outside the scroller: an overflow-x:auto
              container also clips dropdowns vertically. */}
          <div className="flex items-center gap-2 shrink-0 sm:contents">
            <FilterMenu value={filters} onChange={setFilters} />
            <ToolbarMenu
              onRefresh={() => mutate()}
              isRefreshing={isValidating}
              bubbleView={view === "bubbles"}
              paused={paused}
              onTogglePause={() => setPaused((v) => !v)}
              onShowHelp={() => setShowHelp(true)}
            />
          </div>
        </div>

        {tokens && tokens.length > 0 && (
          <ReloadProgressBar
            tokens={tokens}
            isRefreshing={isValidating}
          />
        )}
      </div>

      <ActiveFilterChips filters={filters} onChange={setFilters} />

      {scope === "watchlist" && <WatchlistBar />}

      <div className="flex-1 relative bg-black">
        {isLoading && !tokens && <BubblesSkeleton />}

        {error && !tokens && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {tr("failedLoad")}
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
              {tr("retry")}
            </button>
          </div>
        )}

        {view === "bubbles" && visibleTokens && visibleTokens.length > 0 && (
          <ColorLegend timeframe={timeframe} metric={metric} />
        )}

        {view === "bubbles" && visibleTokens && visibleTokens.length > 0 && (
          <BubbleCanvas
            tokens={visibleTokens}
            timeframe={timeframe}
            metric={metric}
            focusedId={selected?.token.id ?? null}
            heldIds={heldIds}
            paused={paused}
            density={filters.density}
            onBubbleClick={handleBubbleClick}
          />
        )}

        {view === "list" && visibleTokens && visibleTokens.length > 0 && (
          <BubbleList
            tokens={visibleTokens}
            timeframe={timeframe}
            heldIds={heldIds}
            selectedId={selected?.token.id ?? null}
            onRowClick={handleBubbleClick}
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
            {tr("stacksNote")}
          </div>
        )}

        {visibleTokens && visibleTokens.length === 0 && tokens && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="text-3xl opacity-60">
              {search.trim()
                ? "🔎"
                : scope === "watchlist"
                ? "⭐"
                : scope === "holdings"
                ? "👛"
                : "📭"}
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {search.trim()
                ? tr("noMatch", { q: search })
                : scope === "watchlist"
                ? tr("watchlistEmpty")
                : scope === "holdings"
                ? isConnected
                  ? tr("holdingsEmptyTracked")
                  : tr("holdingsConnect")
                : tr("noStacksTokens")}
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
                {tr("clearSearch")}
              </button>
            )}
            {!search.trim() &&
              (scope === "watchlist" || scope === "holdings") && (
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
                {tr("browseAll")}
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
          {tr("dataOutdated")}
        </div>
      )}
    </div>
  );
}
