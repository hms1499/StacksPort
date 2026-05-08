"use client";

import { cn } from "@/lib/utils";

export type Timeframe = "1h" | "24h" | "7d";

const OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "1h", label: "1H" },
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
];

interface TimeframeToggleProps {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export default function TimeframeToggle({
  value,
  onChange,
}: TimeframeToggleProps) {
  return (
    <div className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--bg-card)" }}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200",
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
