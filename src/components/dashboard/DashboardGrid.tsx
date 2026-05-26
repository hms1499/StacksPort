"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { RotateCcw } from "lucide-react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import WidgetShell from "@/components/dashboard/WidgetShell";

// Always-rendered widgets that go in the resizable grid.
const BalanceCard = dynamic(() => import("@/components/dashboard/BalanceCard"));
const STXMarketStats = dynamic(() => import("@/components/dashboard/STXMarketStats"));
const PoxCycleCard = dynamic(() => import("@/components/dashboard/PoxCycleCard"));
const GreedIndexCard = dynamic(() => import("@/components/dashboard/GreedIndexCard"));
const TrendingTokens = dynamic(() => import("@/components/dashboard/TrendingTokens"));
const CryptoNews = dynamic(() => import("@/components/dashboard/CryptoNews"));
const RecentActivity = dynamic(() => import("@/components/dashboard/RecentActivity"));

// Conditional widgets — render outside the grid as a normal stack above it,
// so when they self-hide they don't leave empty cells.
const WalletBanner = dynamic(() => import("@/components/dashboard/WalletBanner"));
const WelcomeSteps = dynamic(() => import("@/components/dashboard/WelcomeSteps"));
const QuickActions = dynamic(() => import("@/components/dashboard/QuickActions"));
const AlertsPanel = dynamic(() => import("@/components/dashboard/AlertsPanel"));
const DCAPerformanceCard = dynamic(() => import("@/components/dashboard/DCAPerformanceCard"));
const DCASummaryCard = dynamic(() => import("@/components/dashboard/DCASummaryCard"));

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function DashboardGrid() {
  const { layouts, onLayoutChange, reset, hydrated } = useDashboardLayout();

  const widgets = useMemo(
    () => [
      { i: "balance", node: <BalanceCard /> },
      { i: "stx-stats", node: <STXMarketStats /> },
      { i: "pox-cycle", node: <PoxCycleCard /> },
      { i: "greed", node: <GreedIndexCard /> },
      { i: "trending", node: <TrendingTokens /> },
      { i: "news", node: <CryptoNews /> },
      { i: "activity", node: <RecentActivity /> },
    ],
    [],
  );

  return (
    <div className="w-full">
      {/* Conditional widgets — natural flow above the grid */}
      <div className="space-y-4 mb-4">
        <WalletBanner />
        <WelcomeSteps />
        <QuickActions />
        <AlertsPanel />
        <DCAPerformanceCard />
        <DCASummaryCard />
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground/70">
          Drag the handle in each card to reorder · drag the bottom-right corner to resize
        </span>
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
        breakpoints={{ lg: 900, md: 640, sm: 0 }}
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
          <div key={w.i} className="group">
            <WidgetShell>{w.node}</WidgetShell>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
