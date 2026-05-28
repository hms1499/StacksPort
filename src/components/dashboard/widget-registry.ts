import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// Single source of truth for grid widgets. Adding a widget = appending one
// entry here. Layout defaults (per breakpoint), the component reference,
// the screen-reader label, and the visibility tags all live together so
// they can't drift out of sync.

export type WidgetId =
  | "balance"
  | "quick-actions"
  | "stx-stats"
  | "pox-cycle"
  | "alerts"
  | "dca-perf"
  | "dca-summary"
  | "greed"
  | "trending"
  | "news"
  | "activity";

// Declarative capability tags. The visibility hook computes which tags the
// current session has and shows widgets whose `requires` are all satisfied.
// Extending: add a new tag here, then teach useDashboardVisibility how to
// compute it. Per-widget changes stay 1-line.
export type RequiresTag = "wallet" | "alerts" | "dcaExecuted";

export type Cell = {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

export type WidgetEntry = {
  id: WidgetId;
  /** Human-readable name used for aria-label and screen reader announcements. */
  label: string;
  component: ComponentType;
  lg: Cell;
  md: Cell;
  /** If omitted, the widget is always visible. All listed tags must be present. */
  requires?: RequiresTag[];
  /**
   * Which shared snapshot backs this widget's data. Drives the hover refresh
   * button — revalidating the snapshot refreshes every widget that reads it.
   * Omit for store-backed or action-only widgets that have nothing to refetch.
   */
  refresh?: "market" | "portfolio";
};

export const WIDGETS: WidgetEntry[] = [
  {
    id: "balance",
    label: "Balance",
    component: dynamic(() => import("@/components/dashboard/BalanceCard")),
    refresh: "portfolio",
    lg: { x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
    md: { x: 0, y: 0, w: 8, h: 6, minW: 4, minH: 4 },
  },
  {
    id: "quick-actions",
    label: "Quick actions",
    component: dynamic(() => import("@/components/dashboard/QuickActions")),
    requires: ["wallet"],
    lg: { x: 0, y: 6, w: 12, h: 1, minW: 6, minH: 1 },
    md: { x: 0, y: 6, w: 8, h: 1, minW: 4, minH: 1 },
  },
  {
    id: "stx-stats",
    label: "STX market stats",
    component: dynamic(() => import("@/components/dashboard/STXMarketStats")),
    refresh: "market",
    lg: { x: 0, y: 8, w: 12, h: 3, minW: 6, minH: 2 },
    md: { x: 0, y: 8, w: 8, h: 3, minW: 4, minH: 2 },
  },
  {
    id: "pox-cycle",
    label: "PoX cycle",
    component: dynamic(() => import("@/components/dashboard/PoxCycleCard")),
    refresh: "market",
    lg: { x: 0, y: 11, w: 12, h: 4, minW: 6, minH: 3 },
    md: { x: 0, y: 11, w: 8, h: 4, minW: 4, minH: 3 },
  },
  {
    id: "alerts",
    label: "Price alerts",
    component: dynamic(() => import("@/components/dashboard/AlertsPanel")),
    requires: ["alerts"],
    lg: { x: 0, y: 15, w: 6, h: 4, minW: 3, minH: 3 },
    md: { x: 0, y: 15, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    id: "dca-perf",
    label: "DCA performance",
    component: dynamic(() => import("@/components/dashboard/DCAPerformanceCard")),
    requires: ["wallet", "dcaExecuted"],
    refresh: "portfolio",
    lg: { x: 6, y: 15, w: 6, h: 4, minW: 3, minH: 3 },
    md: { x: 4, y: 15, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    id: "dca-summary",
    label: "DCA summary",
    component: dynamic(() => import("@/components/dashboard/DCASummaryCard")),
    requires: ["wallet"],
    refresh: "portfolio",
    lg: { x: 0, y: 19, w: 4, h: 5, minW: 3, minH: 3 },
    md: { x: 0, y: 19, w: 4, h: 5, minW: 3, minH: 3 },
  },
  {
    id: "greed",
    label: "Fear and greed index",
    component: dynamic(() => import("@/components/dashboard/GreedIndexCard")),
    refresh: "market",
    lg: { x: 4, y: 19, w: 4, h: 5, minW: 3, minH: 3 },
    md: { x: 4, y: 19, w: 4, h: 5, minW: 3, minH: 3 },
  },
  {
    id: "trending",
    label: "Trending tokens",
    component: dynamic(() => import("@/components/dashboard/TrendingTokens")),
    refresh: "market",
    lg: { x: 8, y: 19, w: 4, h: 5, minW: 3, minH: 4 },
    md: { x: 0, y: 24, w: 8, h: 5, minW: 4, minH: 4 },
  },
  {
    id: "news",
    label: "Crypto news",
    component: dynamic(() => import("@/components/dashboard/CryptoNews")),
    refresh: "market",
    lg: { x: 0, y: 24, w: 8, h: 6, minW: 4, minH: 2 },
    md: { x: 0, y: 29, w: 8, h: 6, minW: 4, minH: 2 },
  },
  {
    id: "activity",
    label: "Recent activity",
    component: dynamic(() => import("@/components/dashboard/RecentActivity")),
    refresh: "portfolio",
    lg: { x: 8, y: 24, w: 4, h: 6, minW: 3, minH: 2 },
    md: { x: 0, y: 35, w: 8, h: 6, minW: 4, minH: 2 },
  },
];

export const KNOWN_WIDGET_IDS: Set<string> = new Set(WIDGETS.map((w) => w.id));
