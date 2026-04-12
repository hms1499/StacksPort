"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SentimentData } from "@/lib/ai";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 30
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : score <= -30
        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";

  const label = score >= 30 ? "Bullish" : score <= -30 ? "Bearish" : "Neutral";

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold", color)}>
      {score >= 30 ? <TrendingUp size={14} /> : score <= -30 ? <TrendingDown size={14} /> : <Minus size={14} />}
      {label} ({score > 0 ? "+" : ""}{score})
    </span>
  );
}

export default function SentimentCard({ data }: { data: SentimentData }) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Market Sentiment</h3>
        <ScoreBadge score={data.score} />
      </div>

      <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {data.summary}
      </p>

      {/* Fear & Greed */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Fear & Greed
        </span>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
          <div
            className={cn(
              "h-full rounded-full transition-all",
              data.fearGreedValue >= 60
                ? "bg-green-500"
                : data.fearGreedValue >= 40
                  ? "bg-yellow-500"
                  : "bg-red-500"
            )}
            style={{ width: `${data.fearGreedValue}%` }}
          />
        </div>
        <span className="text-sm font-semibold min-w-[2.5rem] text-right" style={{ color: 'var(--text-primary)' }}>
          {data.fearGreedValue}
        </span>
      </div>

      {/* Signals */}
      <div className="flex flex-wrap gap-2">
        {data.signals.map((signal, i) => (
          <span
            key={i}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium",
              signal.type === "bullish"
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : signal.type === "bearish"
                  ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  : "text-[color:var(--text-muted)] bg-[var(--bg-elevated)]"
            )}
          >
            {signal.label}
          </span>
        ))}
      </div>
    </div>
  );
}
