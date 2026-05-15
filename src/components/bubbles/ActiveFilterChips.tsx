"use client";

import { X } from "lucide-react";
import {
  DEFAULT_FILTERS,
  type BubbleFilters,
  type SortBy,
} from "./FilterMenu";

interface ActiveFilterChipsProps {
  filters: BubbleFilters;
  onChange: (v: BubbleFilters) => void;
}

function fmtMcap(v: number): string {
  if (v >= 1_000_000_000) return `$${v / 1_000_000_000}B+`;
  if (v >= 1_000_000) return `$${v / 1_000_000}M+`;
  return `$${v}+`;
}

const SORT_LABEL: Record<SortBy, string> = {
  mcap: "Market cap",
  volume: "Volume",
  gainers: "Top gainers",
  losers: "Top losers",
  name: "A–Z",
};

export default function ActiveFilterChips({
  filters,
  onChange,
}: ActiveFilterChipsProps) {
  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (filters.minMarketCap > 0) {
    chips.push({
      key: "mcap",
      label: fmtMcap(filters.minMarketCap),
      onRemove: () => onChange({ ...filters, minMarketCap: 0 }),
    });
  }
  if (filters.topN > 0) {
    chips.push({
      key: "top",
      label: `Top ${filters.topN}`,
      onRemove: () => onChange({ ...filters, topN: 0 }),
    });
  }
  if (filters.moversThreshold > 0) {
    chips.push({
      key: "mv",
      label: `≥${filters.moversThreshold}%`,
      onRemove: () => onChange({ ...filters, moversThreshold: 0 }),
    });
  }
  if (filters.excludeStables) {
    chips.push({
      key: "ns",
      label: "No stables",
      onRemove: () => onChange({ ...filters, excludeStables: false }),
    });
  }
  if (filters.sortBy !== "mcap") {
    chips.push({
      key: "sort",
      label: `Sort: ${SORT_LABEL[filters.sortBy]}`,
      onRemove: () => onChange({ ...filters, sortBy: "mcap" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div
      className="px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onRemove}
          className="shrink-0 text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full hover:opacity-80"
          style={{
            backgroundColor: "rgba(64,138,113,0.18)",
            color: "#5fb594",
            border: "1px solid rgba(64,138,113,0.35)",
          }}
        >
          {c.label}
          <X size={10} />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(DEFAULT_FILTERS)}
        className="shrink-0 text-[10px] px-2 py-0.5 ml-1 hover:opacity-80"
        style={{ color: "var(--text-muted)" }}
      >
        Clear all
      </button>
    </div>
  );
}
