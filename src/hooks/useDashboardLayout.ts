"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout, Layouts } from "react-grid-layout";

const STORAGE_KEY = "dashboard-layout-v1";

export type WidgetId =
  | "wallet-banner"
  | "welcome-steps"
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

type WidgetSpec = {
  i: WidgetId;
  // lg = 12 cols, md = 8 cols, sm = 1 col (single column on mobile)
  lg: { x: number; y: number; w: number; h: number; minW?: number; minH?: number; maxW?: number };
  md: { x: number; y: number; w: number; h: number; minW?: number; minH?: number; maxW?: number };
  sm: { x: number; y: number; w: number; h: number };
};

// Default layout. Row height = 80px, so h=4 ≈ 320px content height.
export const WIDGETS: WidgetSpec[] = [
  { i: "wallet-banner",  lg: { x: 0, y: 0,  w: 12, h: 1, minW: 6, minH: 1 }, md: { x: 0, y: 0,  w: 8, h: 1 }, sm: { x: 0, y: 0,  w: 1, h: 1 } },
  { i: "welcome-steps",  lg: { x: 0, y: 1,  w: 12, h: 3, minW: 6, minH: 2 }, md: { x: 0, y: 1,  w: 8, h: 3 }, sm: { x: 0, y: 1,  w: 1, h: 3 } },
  { i: "balance",        lg: { x: 0, y: 4,  w: 12, h: 5, minW: 6, minH: 4 }, md: { x: 0, y: 4,  w: 8, h: 5 }, sm: { x: 0, y: 4,  w: 1, h: 5 } },
  { i: "quick-actions",  lg: { x: 0, y: 9,  w: 12, h: 2, minW: 6, minH: 2 }, md: { x: 0, y: 9,  w: 8, h: 2 }, sm: { x: 0, y: 9,  w: 1, h: 3 } },
  { i: "stx-stats",      lg: { x: 0, y: 11, w: 12, h: 3, minW: 6, minH: 2 }, md: { x: 0, y: 11, w: 8, h: 3 }, sm: { x: 0, y: 12, w: 1, h: 7 } },
  { i: "pox-cycle",      lg: { x: 0, y: 14, w: 12, h: 4, minW: 6, minH: 3 }, md: { x: 0, y: 14, w: 8, h: 4 }, sm: { x: 0, y: 19, w: 1, h: 4 } },
  { i: "alerts",         lg: { x: 0, y: 18, w: 6,  h: 4, minW: 3, minH: 3 }, md: { x: 0, y: 18, w: 4, h: 4 }, sm: { x: 0, y: 23, w: 1, h: 4 } },
  { i: "dca-perf",       lg: { x: 6, y: 18, w: 6,  h: 4, minW: 3, minH: 3 }, md: { x: 4, y: 18, w: 4, h: 4 }, sm: { x: 0, y: 27, w: 1, h: 4 } },
  { i: "dca-summary",    lg: { x: 0, y: 22, w: 4,  h: 5, minW: 3, minH: 3 }, md: { x: 0, y: 22, w: 4, h: 5 }, sm: { x: 0, y: 31, w: 1, h: 5 } },
  { i: "greed",          lg: { x: 4, y: 22, w: 4,  h: 5, minW: 3, minH: 3 }, md: { x: 4, y: 22, w: 4, h: 5 }, sm: { x: 0, y: 36, w: 1, h: 5 } },
  { i: "trending",       lg: { x: 8, y: 22, w: 4,  h: 5, minW: 3, minH: 4 }, md: { x: 0, y: 27, w: 8, h: 5 }, sm: { x: 0, y: 41, w: 1, h: 5 } },
  { i: "news",           lg: { x: 0, y: 27, w: 8,  h: 6, minW: 4, minH: 4 }, md: { x: 0, y: 32, w: 8, h: 6 }, sm: { x: 0, y: 46, w: 1, h: 6 } },
  { i: "activity",       lg: { x: 8, y: 27, w: 4,  h: 6, minW: 3, minH: 4 }, md: { x: 0, y: 38, w: 8, h: 6 }, sm: { x: 0, y: 52, w: 1, h: 6 } },
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

// Merge stored layout with defaults so newly added widgets still show up.
function mergeWithDefaults(stored: Layouts | null): Layouts {
  const defaults = buildDefaultLayouts();
  if (!stored) return defaults;
  const merge = (bp: keyof Layouts) => {
    const def = defaults[bp] ?? [];
    const cur = stored[bp] ?? [];
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
