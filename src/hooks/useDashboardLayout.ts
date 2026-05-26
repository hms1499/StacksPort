"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout, Layouts } from "react-grid-layout";

// v5: dropped `sm` breakpoint (mobile renders as plain stack outside RGL) and
// added minW/minH on `md` so resize stops short of unusable widget sizes.
const STORAGE_KEY = "dashboard-layout-v5";

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

type Cell = { x: number; y: number; w: number; h: number; minW?: number; minH?: number };

type WidgetSpec = {
  i: WidgetId;
  lg: Cell;
  md: Cell;
};

// Row height = 80px. minW/minH set per-breakpoint so resize handle stops at a
// size where the widget's content is still usable.
export const WIDGETS: WidgetSpec[] = [
  { i: "balance",       lg: { x: 0, y: 0,  w: 12, h: 6, minW: 6, minH: 4 }, md: { x: 0, y: 0,  w: 8, h: 6, minW: 4, minH: 4 } },
  { i: "quick-actions", lg: { x: 0, y: 6,  w: 12, h: 1, minW: 6, minH: 1 }, md: { x: 0, y: 6,  w: 8, h: 1, minW: 4, minH: 1 } },
  { i: "stx-stats",     lg: { x: 0, y: 8,  w: 12, h: 3, minW: 6, minH: 2 }, md: { x: 0, y: 8,  w: 8, h: 3, minW: 4, minH: 2 } },
  { i: "pox-cycle",     lg: { x: 0, y: 11, w: 12, h: 4, minW: 6, minH: 3 }, md: { x: 0, y: 11, w: 8, h: 4, minW: 4, minH: 3 } },
  { i: "alerts",        lg: { x: 0, y: 15, w: 6,  h: 4, minW: 3, minH: 3 }, md: { x: 0, y: 15, w: 4, h: 4, minW: 3, minH: 3 } },
  { i: "dca-perf",      lg: { x: 6, y: 15, w: 6,  h: 4, minW: 3, minH: 3 }, md: { x: 4, y: 15, w: 4, h: 4, minW: 3, minH: 3 } },
  { i: "dca-summary",   lg: { x: 0, y: 19, w: 4,  h: 5, minW: 3, minH: 3 }, md: { x: 0, y: 19, w: 4, h: 5, minW: 3, minH: 3 } },
  { i: "greed",         lg: { x: 4, y: 19, w: 4,  h: 5, minW: 3, minH: 3 }, md: { x: 4, y: 19, w: 4, h: 5, minW: 3, minH: 3 } },
  { i: "trending",      lg: { x: 8, y: 19, w: 4,  h: 5, minW: 3, minH: 4 }, md: { x: 0, y: 24, w: 8, h: 5, minW: 4, minH: 4 } },
  // news + activity scroll internally now, so minH can drop to 2 (160px) —
  // enough to show ~2 items + a scroll affordance without clipping the header.
  { i: "news",          lg: { x: 0, y: 24, w: 8,  h: 6, minW: 4, minH: 2 }, md: { x: 0, y: 29, w: 8, h: 6, minW: 4, minH: 2 } },
  { i: "activity",      lg: { x: 8, y: 24, w: 4,  h: 6, minW: 3, minH: 2 }, md: { x: 0, y: 35, w: 8, h: 6, minW: 4, minH: 2 } },
];

const KNOWN_IDS: Set<string> = new Set(WIDGETS.map((w) => w.i));

function buildDefaultLayouts(): Layouts {
  const pick = (bp: "lg" | "md"): Layout[] =>
    WIDGETS.map((w) => ({ i: w.i, ...w[bp] }));
  return { lg: pick("lg"), md: pick("md") };
}

function isValidLayoutItem(it: unknown): it is Layout {
  if (!it || typeof it !== "object") return false;
  const l = it as Record<string, unknown>;
  return (
    typeof l.i === "string" &&
    KNOWN_IDS.has(l.i) &&
    Number.isFinite(l.x) && (l.x as number) >= 0 &&
    Number.isFinite(l.y) && (l.y as number) >= 0 &&
    Number.isFinite(l.w) && (l.w as number) > 0 &&
    Number.isFinite(l.h) && (l.h as number) > 0
  );
}

function readStored(): Layouts | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const out: Layouts = {};
    for (const bp of ["lg", "md"] as const) {
      const arr = (parsed as Record<string, unknown>)[bp];
      if (!Array.isArray(arr)) continue;
      const cleaned = arr.filter(isValidLayoutItem);
      // Drop duplicate ids (last write wins).
      const seen = new Set<string>();
      const dedup: Layout[] = [];
      for (let i = cleaned.length - 1; i >= 0; i--) {
        if (seen.has(cleaned[i].i)) continue;
        seen.add(cleaned[i].i);
        dedup.unshift(cleaned[i]);
      }
      out[bp] = dedup;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function mergeWithDefaults(stored: Layouts | null): Layouts {
  const defaults = buildDefaultLayouts();
  if (!stored) return defaults;
  const merge = (bp: keyof Layouts) => {
    const def = defaults[bp] ?? [];
    const cur = stored[bp] ?? [];
    const known = new Set(cur.map((l) => l.i));
    // Re-apply minW/minH from defaults so stored layouts can't escape the
    // constraints we ship (older v5 entries may predate a tightened minimum).
    const defMins = new Map(def.map((d) => [d.i, { minW: d.minW, minH: d.minH }]));
    const withMins = cur.map((l) => {
      const m = defMins.get(l.i);
      return m ? { ...l, minW: m.minW, minH: m.minH } : l;
    });
    const missing = def.filter((l) => !known.has(l.i));
    return [...withMins, ...missing];
  };
  return { lg: merge("lg"), md: merge("md") };
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
