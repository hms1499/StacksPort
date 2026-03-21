"use client";

import { useEffect, useState } from "react";
import { Info, ExternalLink } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";

interface FearGreedData {
  value: number;
  classification: string;
}

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

function SemiGauge({ value, isDark }: { value: number; isDark: boolean }) {
  const r = 85;
  const cx = 110;
  const cy = 115; // pivot at bottom

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const pt = (deg: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy - r * Math.sin(toRad(deg)),
  });

  // sweep=1 → clockwise in SVG screen (draws arc going UPWARD through top)
  const arc = (from: number, to: number) => {
    const s = pt(from);
    const e = pt(to);
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  // 5 equal segments: 180°→144°→108°→72°→36°→0°
  const segments = [
    { from: 180, to: 144, color: "#ef4444" }, // Extreme Fear
    { from: 144, to: 108, color: "#f97316" }, // Fear
    { from: 108, to: 72,  color: "#eab308" }, // Neutral
    { from: 72,  to: 36,  color: "#84cc16" }, // Greed
    { from: 36,  to: 0,   color: "#22c55e" }, // Extreme Greed
  ];

  // value=0 → needle left (180°), value=100 → needle right (0°)
  const needleAngle = 180 - (value / 100) * 180;
  const tip = pt(needleAngle);
  const label = CLASSIFICATIONS.find((c) => value >= c.min && value <= c.max)?.label ?? "";
  const color = getColor(value);

  return (
    <svg viewBox="0 0 220 145" className="w-full max-w-[280px] mx-auto">
      {/* Arc segments with rounded caps for the Zoof look */}
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

      {/* Value + label text ABOVE pivot */}
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

      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={tip.x.toFixed(2)}
        y2={tip.y.toFixed(2)}
        stroke={isDark ? "#e5e7eb" : "#1f2937"}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      {/* Pivot circle */}
      <circle cx={cx} cy={cy} r={7} fill={isDark ? "#e5e7eb" : "#1f2937"} />
      <circle cx={cx} cy={cy} r={3.5} fill={isDark ? "#1f2937" : "white"} />
    </svg>
  );
}

export default function GreedIndexCard() {
  const isDark = useThemeStore((s) => s.theme === "dark");
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://api.alternative.me/fng/?limit=1")
      .then((r) => r.json())
      .then((json) => {
        const d = json.data?.[0];
        if (d) {
          setData({
            value: Number(d.value),
            classification: d.value_classification,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Greed Index</h2>
          <Info size={13} className="text-gray-400" />
        </div>
        <a
          href="https://alternative.me/crypto/fear-and-greed-index/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-teal-500 hover:text-teal-600 transition-colors"
        >
          See all <ExternalLink size={11} />
        </a>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-6 animate-pulse">
          <div className="w-52 h-28 bg-gray-100 dark:bg-gray-700 rounded-xl" />
          <div className="h-4 w-20 bg-gray-100 dark:bg-gray-700 rounded" />
        </div>
      ) : data ? (
        <div className="flex flex-col items-center">
          <SemiGauge value={data.value} isDark={isDark} />
          <div className="flex gap-5 mt-3 text-xs text-gray-400">
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
        <p className="text-sm text-gray-400 text-center py-8">Failed to load index</p>
      )}
    </div>
  );
}
