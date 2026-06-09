"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type Metric = "change" | "marketCap" | "volume";

const OPTIONS: { value: Metric; label: string; titleKey: string }[] = [
  { value: "change", label: "%", titleKey: "changeTitle" },
  { value: "marketCap", label: "MC", titleKey: "mcapTitle" },
  { value: "volume", label: "Vol", titleKey: "volTitle" },
];

interface MetricToggleProps {
  value: Metric;
  onChange: (m: Metric) => void;
}

export default function MetricToggle({ value, onChange }: MetricToggleProps) {
  const t = useTranslations("bubbles.metric");
  return (
    <div className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--bg-card)" }}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          title={t(opt.titleKey)}
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
