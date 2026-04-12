"use client";

import { memo } from "react";
import { Info, ExternalLink } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";
import { useFearGreed } from "@/hooks/useMarketData";

const CLASSIFICATIONS = [
  { label: "Extreme Fear", min: 0, max: 24, color: "#ef4444" },
  { label: "Fear", min: 25, max: 44, color: "#f97316" },
  { label: "Neutral", min: 45, max: 55, color: "#eab308" },
  { label: "Greed", min: 56, max: 75, color: "#84cc16" },
  { label: "Extreme Greed", min: 76, max: 100, color: "#22c55e" },
];

function getColor(value: number): string {
  return CLASSIFICATIONS.find((c) => value >= c.min && value <= c.max)?.color ?? "#eab308";
}

const SemiGauge = memo(function SemiGauge({ value, isDark }: { value: number; isDark: boolean }) {
  const r = 85;
  const cx = 110;
  const cy = 115;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const pt = (deg: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy - r * Math.sin(toRad(deg)),
  });

  const arc = (from: number, to: number) => {
    const s = pt(from);
    const e = pt(to);
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  const segments = [
    { from: 180, to: 144, color: "#ef4444" },
    { from: 144, to: 108, color: "#f97316" },
    { from: 108, to: 72,  color: "#eab308" },
    { from: 72,  to: 36,  color: "#84cc16" },
    { from: 36,  to: 0,   color: "#22c55e" },
  ];

  const needleAngle = 180 - (value / 100) * 180;
  const tip = pt(needleAngle);
  const label = CLASSIFICATIONS.find((c) => value >= c.min && value <= c.max)?.label ?? "";
  const color = getColor(value);

  return (
    <svg viewBox="0 0 220 145" className="w-full max-w-[280px] mx-auto">
      {segments.map((seg, i) => (
        <path
          key={i}
          d={arc(seg.from, seg.to)}
          stroke={seg.color}
          strokeWidth={20}
          fill="none"
          strokeLinecap="round"
        />
      ))}

      <text
        x={cx}
        y={cy - 30}
        textAnchor="middle"
        fontSize="32"
        fontWeight="bold"
        fill={isDark ? "#f3f4f6" : "#111827"}
        fontFamily="system-ui, sans-serif"
      >
        {value}
      </text>
      <text
        x={cx}
        y={cy - 12}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill={color}
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>

      <line
        x1={cx}
        y1={cy}
        x2={tip.x.toFixed(2)}
        y2={tip.y.toFixed(2)}
        stroke={isDark ? "#e5e7eb" : "#1f2937"}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      <circle cx={cx} cy={cy} r={7} fill={isDark ? "#e5e7eb" : "#1f2937"} />
      <circle cx={cx} cy={cy} r={3.5} fill={isDark ? "#1f2937" : "white"} />
    </svg>
  );
});

export default function GreedIndexCard() {
  const isDark = useThemeStore((s) => s.theme === "dark");
  const { data, isLoading } = useFearGreed();

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Greed Index</h2>
          <Info size={13} style={{ color: 'var(--text-muted)' }} />
        </div>
        <a
          href="https://alternative.me/crypto/fear-and-greed-index/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ color: 'var(--accent)' }}
        >
          See all <ExternalLink size={11} />
        </a>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-6 animate-pulse">
          <div className="w-52 h-28 rounded-xl" style={{ backgroundColor: 'var(--border-subtle)' }} />
          <div className="h-4 w-20 rounded" style={{ backgroundColor: 'var(--border-subtle)' }} />
        </div>
      ) : data ? (
        <div className="flex flex-col items-center">
          <SemiGauge value={data.value} isDark={isDark} />
          <div className="flex gap-5 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              Fear
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
              Neutral
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Greed
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Failed to load index</p>
      )}
    </div>
  );
}
