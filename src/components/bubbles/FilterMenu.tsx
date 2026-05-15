"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

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

const VALID_SORT: SortBy[] = ["mcap", "volume", "gainers", "losers", "name"];

export function filtersFromParams(params: URLSearchParams): BubbleFilters {
  const mcap = Number(params.get("mcap")) || 0;
  const top = Number(params.get("top")) || 0;
  const mv = Number(params.get("mv")) || 0;
  const ns = params.get("ns") === "1";
  const sortRaw = params.get("sort");
  const sortBy: SortBy =
    sortRaw && (VALID_SORT as string[]).includes(sortRaw)
      ? (sortRaw as SortBy)
      : "mcap";
  return {
    minMarketCap: mcap > 0 ? mcap : 0,
    excludeStables: ns,
    topN: top > 0 ? top : 0,
    moversThreshold: mv > 0 ? mv : 0,
    sortBy,
  };
}

export function filtersToParams(
  params: URLSearchParams,
  filters: BubbleFilters
): void {
  if (filters.minMarketCap > 0) params.set("mcap", String(filters.minMarketCap));
  else params.delete("mcap");
  if (filters.topN > 0) params.set("top", String(filters.topN));
  else params.delete("top");
  if (filters.moversThreshold > 0)
    params.set("mv", String(filters.moversThreshold));
  else params.delete("mv");
  if (filters.excludeStables) params.set("ns", "1");
  else params.delete("ns");
  if (filters.sortBy !== "mcap") params.set("sort", filters.sortBy);
  else params.delete("sort");
}

export function hasAnyFilterParam(params: URLSearchParams): boolean {
  return (
    params.has("mcap") ||
    params.has("top") ||
    params.has("mv") ||
    params.has("ns") ||
    params.has("sort")
  );
}

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
  const [isMobile, setIsMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const inTrigger = ref.current?.contains(e.target as Node);
      const inSheet = sheetRef.current?.contains(e.target as Node);
      if (!inTrigger && !inSheet) setOpen(false);
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
        <span className="hidden sm:inline">Filters</span>
        {active && (
          <span
            className="ml-0.5 text-[10px] font-mono px-1 rounded"
            style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && isMobile && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] motion-safe:animate-[fadeIn_150ms_ease-out]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={sheetRef}
            className="fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl border-t border-x p-4 flex flex-col gap-3 motion-safe:animate-[slideUp_180ms_ease-out]"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-subtle)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div className="flex justify-center -mt-1 mb-1">
              <div
                className="h-1 w-10 rounded-full"
                style={{ backgroundColor: "var(--border-subtle)" }}
              />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Filters
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="hover:opacity-80"
              >
                <X size={16} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
            <FilterBody value={value} onChange={onChange} active={active} />
          </div>
        </>
      )}

      {open && !isMobile && (
        <div
          ref={sheetRef}
          className="absolute right-0 mt-1.5 z-30 w-60 rounded-lg p-3 flex flex-col gap-3"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <FilterBody value={value} onChange={onChange} active={active} />
        </div>
      )}
    </div>
  );
}

function FilterBody({
  value,
  onChange,
  active,
}: {
  value: BubbleFilters;
  onChange: (v: BubbleFilters) => void;
  active: boolean;
}) {
  return (
    <>
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
    </>
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
