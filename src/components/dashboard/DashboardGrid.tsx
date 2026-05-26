"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { RotateCcw } from "lucide-react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import WidgetShell from "@/components/dashboard/WidgetShell";

// Below-the-fold widgets — lazy load to keep initial JS small.
const WalletBanner = dynamic(() => import("@/components/dashboard/WalletBanner"));
const WelcomeSteps = dynamic(() => import("@/components/dashboard/WelcomeSteps"));
const BalanceCard = dynamic(() => import("@/components/dashboard/BalanceCard"));
const QuickActions = dynamic(() => import("@/components/dashboard/QuickActions"));
const STXMarketStats = dynamic(() => import("@/components/dashboard/STXMarketStats"));
const PoxCycleCard = dynamic(() => import("@/components/dashboard/PoxCycleCard"));
const AlertsPanel = dynamic(() => import("@/components/dashboard/AlertsPanel"));
const DCAPerformanceCard = dynamic(() => import("@/components/dashboard/DCAPerformanceCard"));
const DCASummaryCard = dynamic(() => import("@/components/dashboard/DCASummaryCard"));
const GreedIndexCard = dynamic(() => import("@/components/dashboard/GreedIndexCard"));
const TrendingTokens = dynamic(() => import("@/components/dashboard/TrendingTokens"));
const CryptoNews = dynamic(() => import("@/components/dashboard/CryptoNews"));
const RecentActivity = dynamic(() => import("@/components/dashboard/RecentActivity"));

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function DashboardGrid() {
  const { layouts, onLayoutChange, reset, hydrated } = useDashboardLayout();

  const widgets = useMemo(
    () => [
      { i: "wallet-banner", node: <WidgetShell noDrag><WalletBanner /></WidgetShell> },
      { i: "welcome-steps", node: <WidgetShell><WelcomeSteps /></WidgetShell> },
      { i: "balance", node: <WidgetShell><BalanceCard /></WidgetShell> },
      { i: "quick-actions", node: <WidgetShell><QuickActions /></WidgetShell> },
      { i: "stx-stats", node: <WidgetShell><STXMarketStats /></WidgetShell> },
      { i: "pox-cycle", node: <WidgetShell><PoxCycleCard /></WidgetShell> },
      { i: "alerts", node: <WidgetShell><AlertsPanel /></WidgetShell> },
      { i: "dca-perf", node: <WidgetShell><DCAPerformanceCard /></WidgetShell> },
      { i: "dca-summary", node: <WidgetShell><DCASummaryCard /></WidgetShell> },
      { i: "greed", node: <WidgetShell><GreedIndexCard /></WidgetShell> },
      { i: "trending", node: <WidgetShell><TrendingTokens /></WidgetShell> },
      { i: "news", node: <WidgetShell><CryptoNews /></WidgetShell> },
      { i: "activity", node: <WidgetShell><RecentActivity /></WidgetShell> },
    ],
    [],
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-end mb-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
          title="Reset to default layout"
        >
          <RotateCcw size={12} />
          Reset layout
        </button>
      </div>

      <ResponsiveGridLayout
        className={`layout ${hydrated ? "" : "opacity-0"}`}
        layouts={layouts}
        breakpoints={{ lg: 1024, md: 640, sm: 0 }}
        cols={{ lg: 12, md: 8, sm: 1 }}
        rowHeight={80}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        draggableHandle=".drag-handle"
        onLayoutChange={onLayoutChange}
        compactType="vertical"
        useCSSTransforms
      >
        {widgets.map((w) => (
          <div key={w.i} className="relative group">
            {w.node}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
