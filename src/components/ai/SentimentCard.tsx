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
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Market Sentiment</h3>
        <ScoreBadge score={data.score} />
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
        {data.summary}
      </p>

      {/* Fear & Greed */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Fear & Greed
        </span>
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[2.5rem] text-right">
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
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            )}
          >
            {signal.label}
          </span>
        ))}
      </div>
    </div>
  );
}
