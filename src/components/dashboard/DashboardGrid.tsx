"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSWRConfig } from "swr";
import { Check, Eye, EyeOff, Pencil, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useDashboardVisibility } from "@/hooks/useDashboardVisibility";
import { useHiddenWidgets } from "@/hooks/useHiddenWidgets";
import WidgetShell, { type KeyboardMoveHandler } from "@/components/dashboard/WidgetShell";
import WidgetErrorBoundary from "@/components/dashboard/WidgetErrorBoundary";
import { WIDGETS } from "@/components/dashboard/widget-registry";
import { track } from "@/lib/telemetry";

const BREAKPOINTS = { lg: 900, md: 640 } as const;
const COLS = { lg: 12, md: 8 } as const;
type BreakpointKey = keyof typeof COLS;

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

// Banner-style widgets — natural flow above the grid, not resizable. The
// grid widgets themselves live in widget-registry.ts.
const WalletBanner = dynamic(() => import("@/components/dashboard/WalletBanner"));
const WelcomeSteps = dynamic(() => import("@/components/dashboard/WelcomeSteps"));

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function DashboardGrid() {
  const { layouts, onLayoutChange, reset, hydrated } = useDashboardLayout();
  const visible = useDashboardVisibility();
  const { hidden, toggle: toggleHidden, showAll } = useHiddenWidgets();
  const isMobile = useIsMobile();
  const { mutate } = useSWRConfig();
  const [widgetsMenuOpen, setWidgetsMenuOpen] = useState(false);

  // Revalidate the snapshot behind a widget. Widgets sharing a snapshot key
  // dedupe to one fetch, so this refreshes every card on that source — the
  // honest behaviour given the snapshot architecture.
  const refreshGroup = (group: "market" | "portfolio") => {
    if (group === "market") return mutate("market-snapshot");
    return mutate(
      (key) =>
        Array.isArray(key) &&
        typeof key[0] === "string" &&
        key[0].startsWith("portfolio"),
    );
  };
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
    setWidgetsMenuOpen(false);
    setIsEditing((v) => {
      const next = !v;
      track(next ? "dashboard_edit_mode_on" : "dashboard_edit_mode_off");
      return next;
    });
  };

  const handleLayoutChange = (current: Layout[], all: Layouts) => {
    // RGL only emits layout entries for rendered widgets, so a hidden widget's
    // saved position would be dropped on any change. Re-inject the entries we
    // already have for ids RGL omitted, keeping the persisted layout complete
    // so re-showing a widget restores its position instead of auto-placing it.
    const merged: Layouts = {};
    (Object.keys(all) as (keyof Layouts)[]).forEach((bp) => {
      const incoming = all[bp] ?? [];
      const ids = new Set(incoming.map((l) => l.i));
      const preserved = (layouts[bp] ?? []).filter((l) => !ids.has(l.i));
      merged[bp] = [...incoming, ...preserved];
    });
    onLayoutChange(current, merged);
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
    const label = WIDGETS.find((w) => w.id === id)?.label ?? id;
    if (dw !== 0 || dh !== 0) {
      announce(`${label} resized to ${newW} columns by ${newH} rows`);
    } else {
      announce(`${label} moved to column ${newX + 1}, row ${newY + 1}`);
    }
  };

  // Capability-eligible widgets (for the show/hide menu) vs what actually
  // renders (eligible minus the user's manually hidden set).
  const eligibleWidgets = WIDGETS.filter((w) => visible.has(w.id));
  const visibleWidgets = eligibleWidgets.filter((w) => !hidden.has(w.id));

  return (
    <div className="w-full">
      {/* Banner-style widgets — natural flow */}
      <div className="space-y-4 mb-4">
        <WalletBanner />
        <WelcomeSteps />
      </div>

      {isMobile ? (
        <div className="space-y-4">
          {visibleWidgets.map((w) => {
            const W = w.component;
            return (
              <div key={w.id}>
                <WidgetErrorBoundary widgetId={w.id} widgetLabel={w.label}>
                  <W />
                </WidgetErrorBoundary>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2 min-h-[28px]">
            <span className="text-xs text-muted-foreground/70">
              {isEditing
                ? "Drag the handle or use arrow keys to reorder · drag the corner or shift + arrow to resize"
                : null}
            </span>
            <div className="flex items-center gap-1 relative">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setWidgetsMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
                  title="Show or hide widgets"
                  aria-expanded={widgetsMenuOpen}
                  aria-haspopup="menu"
                >
                  <SlidersHorizontal size={12} />
                  Widgets
                  {hidden.size > 0 && (
                    <span
                      className="ml-0.5 px-1 rounded text-[10px] font-bold tabular-nums"
                      style={{ color: "var(--accent)", backgroundColor: "var(--accent-dim)" }}
                    >
                      {hidden.size}
                    </span>
                  )}
                </button>
              )}
              {isEditing && widgetsMenuOpen && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    className="fixed inset-0 z-20 cursor-default"
                    onClick={() => setWidgetsMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    aria-label="Show or hide widgets"
                    className="absolute top-full right-0 mt-1 z-30 w-60 max-h-80 overflow-y-auto rounded-xl p-1.5 shadow-lg"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-fg-muted">
                        Widgets
                      </span>
                      {hidden.size > 0 && (
                        <button
                          type="button"
                          onClick={showAll}
                          className="text-[11px] font-semibold text-brand hover:underline"
                        >
                          Show all
                        </button>
                      )}
                    </div>
                    {eligibleWidgets.map((w) => {
                      const isHidden = hidden.has(w.id);
                      return (
                        <button
                          key={w.id}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={!isHidden}
                          onClick={() => toggleHidden(w.id)}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs text-left hover:bg-sunken transition-colors"
                        >
                          <span className={isHidden ? "text-fg-muted" : "text-fg"}>
                            {w.label}
                          </span>
                          {isHidden ? (
                            <EyeOff size={13} className="text-fg-muted shrink-0" />
                          ) : (
                            <Eye size={13} className="text-brand shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
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
            {visibleWidgets.map((w) => {
              const W = w.component;
              return (
                <div key={w.id} className="group">
                  <WidgetShell
                    isEditing={isEditing}
                    widgetId={w.id}
                    widgetLabel={w.label}
                    onKeyboardMove={moveWidget}
                    onRefresh={w.refresh ? () => refreshGroup(w.refresh!) : undefined}
                  >
                    <WidgetErrorBoundary widgetId={w.id} widgetLabel={w.label}>
                      <W />
                    </WidgetErrorBoundary>
                  </WidgetShell>
                </div>
              );
            })}
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
