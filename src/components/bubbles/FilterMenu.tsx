"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

export type SortBy = "mcap" | "volume" | "gainers" | "losers" | "name";

export interface BubbleFilters {
  minMarketCap: number;
  excludeStables: boolean;
  topN: number;
  moversThreshold: number;
  sortBy: SortBy;
}

export const DEFAULT_FILTERS: BubbleFilters = {
  minMarketCap: 0,
  excludeStables: false,
  topN: 0,
  moversThreshold: 0,
  sortBy: "mcap",
};

const MCAP_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "Any", value: 0 },
  { label: "$10M+", value: 10_000_000 },
  { label: "$100M+", value: 100_000_000 },
  { label: "$1B+", value: 1_000_000_000 },
  { label: "$10B+", value: 10_000_000_000 },
];

const TOPN_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "All", value: 0 },
  { label: "Top 25", value: 25 },
  { label: "Top 50", value: 50 },
  { label: "Top 100", value: 100 },
];

const MOVERS_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "Off", value: 0 },
  { label: "≥1%", value: 1 },
  { label: "≥3%", value: 3 },
  { label: "≥5%", value: 5 },
  { label: "≥10%", value: 10 },
];

interface FilterMenuProps {
  value: BubbleFilters;
  onChange: (v: BubbleFilters) => void;
}

export default function FilterMenu({ value, onChange }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeCount =
    (value.minMarketCap > 0 ? 1 : 0) +
    (value.excludeStables ? 1 : 0) +
    (value.topN > 0 ? 1 : 0) +
    (value.moversThreshold > 0 ? 1 : 0) +
    (value.sortBy !== "mcap" ? 1 : 0);
  const active = activeCount > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Filters"
        title="Filters"
        className="h-7 px-2 rounded-lg flex items-center gap-1 text-xs hover:opacity-80"
        style={{
          backgroundColor: active ? "var(--accent)" : "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          color: active ? "#000" : "var(--text-muted)",
        }}
      >
        <SlidersHorizontal size={12} />
        <span>Filters</span>
        {active && (
          <span
            className="ml-0.5 text-[10px] font-mono px-1 rounded"
            style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 z-30 w-60 rounded-lg p-3 flex flex-col gap-3"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <Group label="Market cap">
            <Choices
              options={MCAP_OPTIONS}
              value={value.minMarketCap}
              onChange={(v) => onChange({ ...value, minMarketCap: v })}
            />
          </Group>

          <Group label="Show">
            <Choices
              options={TOPN_OPTIONS}
              value={value.topN}
              onChange={(v) => onChange({ ...value, topN: v })}
            />
          </Group>

          <Group label="Sort by">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["mcap", "Market cap"],
                  ["volume", "Volume"],
                  ["gainers", "Top gainers"],
                  ["losers", "Top losers"],
                  ["name", "Name (A-Z)"],
                ] as Array<[SortBy, string]>
              ).map(([k, label]) => {
                const a = value.sortBy === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onChange({ ...value, sortBy: k })}
                    className="text-[11px] px-2 py-0.5 rounded hover:opacity-80"
                    style={{
                      backgroundColor: a ? "var(--accent)" : "var(--bg-base)",
                      color: a ? "#000" : "var(--text-primary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Group>

          <Group label="Movers only">
            <Choices
              options={MOVERS_OPTIONS}
              value={value.moversThreshold}
              onChange={(v) => onChange({ ...value, moversThreshold: v })}
            />
          </Group>

          <label className="flex items-center justify-between text-xs cursor-pointer">
            <span style={{ color: "var(--text-primary)" }}>Exclude stablecoins</span>
            <input
              type="checkbox"
              checked={value.excludeStables}
              onChange={(e) =>
                onChange({ ...value, excludeStables: e.target.checked })
              }
            />
          </label>

          {active && (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="text-[11px] mt-1 self-end hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Reset all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[10px] uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Choices({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: number }>;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => onChange(o.value)}
            className="text-[11px] px-2 py-0.5 rounded hover:opacity-80"
            style={{
              backgroundColor: active ? "var(--accent)" : "var(--bg-base)",
              color: active ? "#000" : "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
