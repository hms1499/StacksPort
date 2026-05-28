"use client";

import { useCallback, useEffect, useState } from "react";
import { KNOWN_WIDGET_IDS, type WidgetId } from "@/components/dashboard/widget-registry";

const STORAGE_KEY = "dashboard-hidden-v1";

function readStored(): Set<WidgetId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is WidgetId => typeof id === "string" && KNOWN_WIDGET_IDS.has(id)),
    );
  } catch {
    return new Set();
  }
}

function persist(ids: Set<WidgetId>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota errors
  }
}

/**
 * Manually hidden grid widgets, persisted to localStorage. This is a separate
 * layer from capability visibility (useDashboardVisibility): a widget renders
 * only if it's capability-eligible AND not in this set. Hidden widgets stay in
 * the persisted layout so re-showing pops them back at their saved position.
 */
export function useHiddenWidgets() {
  const [hidden, setHidden] = useState<Set<WidgetId>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHidden(readStored());
    setHydrated(true);
  }, []);

  const toggle = useCallback((id: WidgetId) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setHidden(new Set());
    persist(new Set());
  }, []);

  return { hidden, toggle, showAll, hydrated };
}
