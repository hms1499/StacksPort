"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Check, Pencil, RotateCcw } from "lucide-react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useDashboardVisibility } from "@/hooks/useDashboardVisibility";
import WidgetShell, { type KeyboardMoveHandler } from "@/components/dashboard/WidgetShell";
import { track } from "@/lib/telemetry";

const BREAKPOINTS = { lg: 900, md: 640 } as const;
const COLS = { lg: 12, md: 8 } as const;
type BreakpointKey = keyof typeof COLS;

const WIDGET_LABELS: Record<string, string> = {
  "balance": "Balance",
  "quick-actions": "Quick actions",
  "stx-stats": "STX market stats",
  "pox-cycle": "PoX cycle",
  "alerts": "Price alerts",
  "dca-perf": "DCA performance",
  "dca-summary": "DCA summary",
  "greed": "Fear and greed index",
  "trending": "Trending tokens",
  "news": "Crypto news",
  "activity": "Recent activity",
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Below this width we render widgets as a plain stack — RGL drag/resize is
// unusable on a single-column touch layout (drag handle relies on hover, and
// there's nothing meaningful to resize horizontally).
const MOBILE_MAX_WIDTH = 639;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

// Grid widgets — all are resizable. Connected-only ones are filtered via
// useDashboardVisibility so they don't leave empty cells when hidden.
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

// Banner-style widgets — natural flow above the grid, not resizable.
const WalletBanner = dynamic(() => import("@/components/dashboard/WalletBanner"));
const WelcomeSteps = dynamic(() => import("@/components/dashboard/WelcomeSteps"));

const ResponsiveGridLayout = WidthProvider(Responsive);

// Static — JSX elements here have no dependencies, so building this once at
// module scope is both correct and cheaper than re-creating per render. The
// dynamic() refs above are stable module-level constants.
const WIDGET_NODES: ReadonlyArray<{ i: string; node: React.ReactNode }> = [
  { i: "balance", node: <BalanceCard /> },
  { i: "quick-actions", node: <QuickActions /> },
  { i: "stx-stats", node: <STXMarketStats /> },
  { i: "pox-cycle", node: <PoxCycleCard /> },
  { i: "alerts", node: <AlertsPanel /> },
  { i: "dca-perf", node: <DCAPerformanceCard /> },
  { i: "dca-summary", node: <DCASummaryCard /> },
  { i: "greed", node: <GreedIndexCard /> },
  { i: "trending", node: <TrendingTokens /> },
  { i: "news", node: <CryptoNews /> },
  { i: "activity", node: <RecentActivity /> },
];

export default function DashboardGrid() {
  const { layouts, onLayoutChange, reset, hydrated } = useDashboardLayout();
  const visible = useDashboardVisibility();
  const isMobile = useIsMobile();
  // Edit mode is session-only: explicit opt-in each visit avoids users
  // leaving themselves in a draggable state forever and accidentally moving
  // widgets while reading.
  const [isEditing, setIsEditing] = useState(false);

  // One-shot telemetry guards. Each session counts at most once for the
  // "did the user actually mutate anything" metric — that's the signal we
  // care about, not the per-drag spam.
  const viewedRef = useRef(false);
  const mutatedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    track("dashboard_viewed");
  }, []);

  const toggleEdit = () => {
    setIsEditing((v) => {
      const next = !v;
      track(next ? "dashboard_edit_mode_on" : "dashboard_edit_mode_off");
      return next;
    });
  };

  const handleLayoutChange = (current: Layout[], all: Layouts) => {
    onLayoutChange(current, all);
    // Only fire on user-initiated changes (i.e. while editing) and only the
    // first time per session — we want a unique-user counter, not drag spam.
    if (isEditing && !mutatedRef.current) {
      mutatedRef.current = true;
      track("dashboard_layout_mutated");
    }
  };

  const handleReset = () => {
    reset();
    track("dashboard_layout_reset");
  };

  // Track RGL's active breakpoint so keyboard moves edit the right layout
  // array. Default "lg" matches what RGL picks for desktop on first render.
  const [currentBp, setCurrentBp] = useState<BreakpointKey>("lg");

  // Polite live region for screen readers — announces the widget's new
  // position when it's moved/resized via keyboard. Cleared shortly after to
  // avoid stale announcements on subsequent moves.
  const [liveMessage, setLiveMessage] = useState("");
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = (msg: string) => {
    setLiveMessage(msg);
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => setLiveMessage(""), 1500);
  };
  useEffect(() => () => {
    if (liveTimer.current) clearTimeout(liveTimer.current);
  }, []);

  const moveWidget: KeyboardMoveHandler = (id, dx, dy, dw, dh) => {
    if (!isEditing) return;
    const bp = currentBp;
    const cols = COLS[bp];
    const current = layouts[bp] ?? [];
    const item = current.find((l) => l.i === id);
    if (!item) return;
    const minW = item.minW ?? 1;
    const minH = item.minH ?? 1;
    const newW = clamp(item.w + dw, minW, cols);
    const newH = Math.max(minH, item.h + dh);
    const newX = clamp(item.x + dx, 0, cols - newW);
    const newY = Math.max(0, item.y + dy);
    if (newX === item.x && newY === item.y && newW === item.w && newH === item.h) return;
    const updated = current.map((l) => (l.i === id ? { ...l, x: newX, y: newY, w: newW, h: newH } : l));
    const all = { ...layouts, [bp]: updated };
    handleLayoutChange(updated, all);
    const label = WIDGET_LABELS[id] ?? id;
    if (dw !== 0 || dh !== 0) {
      announce(`${label} resized to ${newW} columns by ${newH} rows`);
    } else {
      announce(`${label} moved to column ${newX + 1}, row ${newY + 1}`);
    }
  };

  const visibleWidgets = WIDGET_NODES.filter((w) => visible.has(w.i as never));

  return (
    <div className="w-full">
      {/* Banner-style widgets — natural flow */}
      <div className="space-y-4 mb-4">
        <WalletBanner />
        <WelcomeSteps />
      </div>

      {isMobile ? (
        <div className="space-y-4">
          {visibleWidgets.map((w) => (
            <div key={w.i}>{w.node}</div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2 min-h-[28px]">
            <span className="text-xs text-muted-foreground/70">
              {isEditing
                ? "Drag the handle or use arrow keys to reorder · drag the corner or shift + arrow to resize"
                : null}
            </span>
            <div className="flex items-center gap-1">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
                  title="Reset to default layout"
                >
                  <RotateCcw size={12} />
                  Reset layout
                </button>
              )}
              <button
                type="button"
                onClick={toggleEdit}
                className={`inline-flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md ${
                  isEditing
                    ? "text-[var(--accent)] hover:bg-muted/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={isEditing ? "Finish editing" : "Customize layout"}
                aria-pressed={isEditing}
              >
                {isEditing ? <Check size={12} /> : <Pencil size={12} />}
                {isEditing ? "Done" : "Customize"}
              </button>
            </div>
          </div>

          <ResponsiveGridLayout
            className={`layout ${hydrated ? "" : "opacity-0"} ${isEditing ? "is-editing" : ""}`}
            layouts={layouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={80}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            draggableHandle=".drag-handle"
            onLayoutChange={handleLayoutChange}
            onBreakpointChange={(bp) => setCurrentBp(bp as BreakpointKey)}
            // null = free placement: widgets stay where the user dropped
            // them instead of auto-shifting up. Avoids the "everything jumps"
            // feeling on drag/resize.
            compactType={null}
            preventCollision
            useCSSTransforms
            isDraggable={isEditing}
            isResizable={isEditing}
          >
            {visibleWidgets.map((w) => (
              <div key={w.i} className="group">
                <WidgetShell
                  isEditing={isEditing}
                  widgetId={w.i}
                  widgetLabel={WIDGET_LABELS[w.i]}
                  onKeyboardMove={moveWidget}
                >
                  {w.node}
                </WidgetShell>
              </div>
            ))}
          </ResponsiveGridLayout>

          {/* Screen-reader-only live region for keyboard move announcements. */}
          <div
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {liveMessage}
          </div>
        </>
      )}
    </div>
  );
}
