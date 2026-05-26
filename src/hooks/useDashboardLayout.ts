"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout, Layouts } from "react-grid-layout";

const STORAGE_KEY = "dashboard-layout-v2";

// Only widgets that ALWAYS render content go in the resizable grid.
// Conditional widgets (WalletBanner, WelcomeSteps, QuickActions, AlertsPanel,
// DCAPerformance) are rendered outside the grid in a normal stack — otherwise
// they leave empty cells when their internal hide-condition is met.
export type WidgetId =
  | "balance"
  | "stx-stats"
  | "pox-cycle"
  | "greed"
  | "trending"
  | "news"
  | "activity";

type WidgetSpec = {
  i: WidgetId;
  lg: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  md: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  sm: { x: number; y: number; w: number; h: number };
};

// Row height = 80px. h=5 ≈ 400px usable content height.
export const WIDGETS: WidgetSpec[] = [
  { i: "balance",   lg: { x: 0, y: 0,  w: 12, h: 6, minW: 6, minH: 4 }, md: { x: 0, y: 0,  w: 8, h: 6 }, sm: { x: 0, y: 0,  w: 1, h: 6 } },
  { i: "stx-stats", lg: { x: 0, y: 6,  w: 12, h: 3, minW: 6, minH: 2 }, md: { x: 0, y: 6,  w: 8, h: 3 }, sm: { x: 0, y: 6,  w: 1, h: 7 } },
  { i: "pox-cycle", lg: { x: 0, y: 9,  w: 12, h: 4, minW: 6, minH: 3 }, md: { x: 0, y: 9,  w: 8, h: 4 }, sm: { x: 0, y: 13, w: 1, h: 4 } },
  { i: "greed",     lg: { x: 0, y: 13, w: 6,  h: 5, minW: 3, minH: 3 }, md: { x: 0, y: 13, w: 4, h: 5 }, sm: { x: 0, y: 17, w: 1, h: 5 } },
  { i: "trending",  lg: { x: 6, y: 13, w: 6,  h: 5, minW: 3, minH: 4 }, md: { x: 4, y: 13, w: 4, h: 5 }, sm: { x: 0, y: 22, w: 1, h: 5 } },
  { i: "news",      lg: { x: 0, y: 18, w: 8,  h: 6, minW: 4, minH: 4 }, md: { x: 0, y: 18, w: 8, h: 6 }, sm: { x: 0, y: 27, w: 1, h: 6 } },
  { i: "activity",  lg: { x: 8, y: 18, w: 4,  h: 6, minW: 3, minH: 4 }, md: { x: 0, y: 24, w: 8, h: 6 }, sm: { x: 0, y: 33, w: 1, h: 6 } },
];

function buildDefaultLayouts(): Layouts {
  const pick = (bp: "lg" | "md" | "sm"): Layout[] =>
    WIDGETS.map((w) => ({ i: w.i, ...w[bp] }));
  return { lg: pick("lg"), md: pick("md"), sm: pick("sm") };
}

function readStored(): Layouts | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Layouts;
    if (!parsed?.lg || !Array.isArray(parsed.lg)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function mergeWithDefaults(stored: Layouts | null): Layouts {
  const defaults = buildDefaultLayouts();
  if (!stored) return defaults;
  const ids = new Set<WidgetId>(WIDGETS.map((w) => w.i));
  const merge = (bp: keyof Layouts) => {
    const def = defaults[bp] ?? [];
    const cur = (stored[bp] ?? []).filter((l) => ids.has(l.i as WidgetId));
    const known = new Set(cur.map((l) => l.i));
    const missing = def.filter((l) => !known.has(l.i));
    return [...cur, ...missing];
  };
  return { lg: merge("lg"), md: merge("md"), sm: merge("sm") };
}

export function useDashboardLayout() {
  const [layouts, setLayouts] = useState<Layouts>(() => buildDefaultLayouts());
  const [hydrated, setHydrated] = useState(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLayouts(mergeWithDefaults(readStored()));
    setHydrated(true);
  }, []);

  const onLayoutChange = useCallback((_current: Layout[], all: Layouts) => {
    setLayouts(all);
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch {
        // ignore quota errors
      }
    }, 300);
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setLayouts(buildDefaultLayouts());
  }, []);

  return { layouts, onLayoutChange, reset, hydrated };
}
