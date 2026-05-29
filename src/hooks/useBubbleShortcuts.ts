"use client";

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Timeframe } from "@/components/bubbles/TimeframeToggle";
import type { Scope } from "@/components/bubbles/ScopeToggle";
import type { Metric } from "@/components/bubbles/MetricToggle";
import type { View } from "@/components/bubbles/ViewToggle";

type Options = {
  searchRef: RefObject<HTMLInputElement | null>;
  hasSelected: boolean;
  search: string;
  showHelp: boolean;
  view: View;
  setMetric: (m: Metric) => void;
  setTimeframe: (t: Timeframe) => void;
  setScope: (s: Scope) => void;
  setView: (v: View) => void;
  setSearch: (s: string) => void;
  setShowHelp: Dispatch<SetStateAction<boolean>>;
  setPaused: Dispatch<SetStateAction<boolean>>;
  clearSelected: () => void;
  refresh: () => void;
};

/**
 * Global keyboard shortcuts for the bubbles view. Escape cascades
 * (blur input → close help → close tooltip → clear search); single keys map to
 * metric (1-3), timeframe (q/w/e/r/t), scope (a/s/d/h), refresh (g), pause (p),
 * view toggle (l), search focus (/), and help (?). No-ops while typing.
 */
export function useBubbleShortcuts({
  searchRef,
  hasSelected,
  search,
  showHelp,
  view,
  setMetric,
  setTimeframe,
  setScope,
  setView,
  setSearch,
  setShowHelp,
  setPaused,
  clearSelected,
  refresh,
}: Options) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        if (isTyping) {
          (target as HTMLInputElement).blur();
          return;
        }
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        if (hasSelected) {
          clearSelected();
          return;
        }
        if (search) setSearch("");
        return;
      }

      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "?") {
        setShowHelp((v) => !v);
        return;
      }
      if (e.key === "1") setMetric("change");
      else if (e.key === "2") setMetric("marketCap");
      else if (e.key === "3") setMetric("volume");
      else if (e.key === "q") setTimeframe("1h");
      else if (e.key === "w") setTimeframe("24h");
      else if (e.key === "e") setTimeframe("7d");
      else if (e.key === "r") setTimeframe("30d");
      else if (e.key === "t") setTimeframe("1y");
      else if (e.key === "a") setScope("all");
      else if (e.key === "s") setScope("stacks");
      else if (e.key === "d") setScope("watchlist");
      else if (e.key === "h") setScope("holdings");
      else if (e.key === "g") refresh();
      else if (e.key === "p") setPaused((v) => !v);
      else if (e.key === "l") setView(view === "list" ? "bubbles" : "list");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    searchRef,
    hasSelected,
    search,
    showHelp,
    view,
    setMetric,
    setTimeframe,
    setScope,
    setView,
    setSearch,
    setShowHelp,
    setPaused,
    clearSelected,
    refresh,
  ]);
}
