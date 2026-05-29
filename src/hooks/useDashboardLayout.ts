"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout, Layouts } from "react-grid-layout";
import { KNOWN_WIDGET_IDS, WIDGETS } from "@/components/dashboard/widget-registry";

// v6: compacts the Home first fold so market context appears immediately after
// the portfolio preview. Bumping the key intentionally refreshes saved layouts.
const STORAGE_KEY = "dashboard-layout-v6";

// Re-export so existing consumers (hooks, components) don't need to learn
// about widget-registry.ts unless they want richer entry metadata.
export type { WidgetId } from "@/components/dashboard/widget-registry";

function buildDefaultLayouts(): Layouts {
  const pick = (bp: "lg" | "md"): Layout[] =>
    WIDGETS.map((w) => ({ i: w.id, ...w[bp] }));
  return { lg: pick("lg"), md: pick("md") };
}

function isValidLayoutItem(it: unknown): it is Layout {
  if (!it || typeof it !== "object") return false;
  const l = it as Record<string, unknown>;
  return (
    typeof l.i === "string" &&
    KNOWN_WIDGET_IDS.has(l.i) &&
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
