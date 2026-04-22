"use client";

import { Radio, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import type { KOLSignalsData } from "@/lib/ai";

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function galaxyColor(score: number): { bg: string; text: string } {
  if (score >= 70) return { bg: "rgba(0,229,160,0.12)", text: "#00E5A0" };
  if (score >= 40) return { bg: "rgba(251,191,36,0.12)", text: "#FBBF24" };
  return { bg: "rgba(248,113,113,0.12)", text: "#F87171" };
}

const sentimentConfig = {
  bullish: { Icon: TrendingUp,   color: "#00E5A0" },
  bearish: { Icon: TrendingDown, color: "#F87171" },
  neutral: { Icon: ArrowRight,   color: "#94A3B8" },
};

export default function KOLSignalsCard({ data }: { data: KOLSignalsData }) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio size={16} style={{ color: "var(--accent)" }} />
          <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            Social Signals
          </h3>
        </div>
        <span
          className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "rgba(99,102,241,0.1)", color: "#818CF8" }}
        >
          LunarCrush
        </span>
      </div>

      {/* Summary */}
      {data.summary && (
        <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
          {data.summary}
        </p>
      )}

      {/* Coins list */}
      {data.coins.length === 0 ? (
        <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
          No social data available
        </p>
      ) : (
        <div className="space-y-2">
          {data.coins.map((coin, i) => {
            const { bg, text } = galaxyColor(coin.galaxyScore);
            const { Icon, color } = sentimentConfig[coin.sentiment];
            return (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              >
                {/* Sentiment icon */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon size={14} style={{ color }} />
                </div>

                {/* Coin info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs" style={{ color: "var(--text-primary)" }}>
                      {coin.symbol}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {coin.name}
                    </span>
                    {/* Galaxy Score badge */}
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: bg, color: text }}
                    >
                      G {coin.galaxyScore}
                    </span>
                    {/* Social volume */}
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Vol {formatVolume(coin.socialVolume)}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                    {coin.insight}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
