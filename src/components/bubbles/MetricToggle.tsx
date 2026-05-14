"use client";

import { cn } from "@/lib/utils";

export type Metric = "change" | "marketCap" | "volume";

const OPTIONS: { value: Metric; label: string; title: string }[] = [
  { value: "change", label: "%", title: "Size by % change" },
  { value: "marketCap", label: "MC", title: "Size by market cap" },
  { value: "volume", label: "Vol", title: "Size by 24h volume" },
];

interface MetricToggleProps {
  value: Metric;
  onChange: (m: Metric) => void;
}

export default function MetricToggle({ value, onChange }: MetricToggleProps) {
  return (
    <div className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--bg-card)" }}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          title={opt.title}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200",
            value === opt.value
              ? "bg-[#408A71] text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
