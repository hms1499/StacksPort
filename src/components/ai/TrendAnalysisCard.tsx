"use client";

import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrendData } from "@/lib/ai";

const directionIcon = {
  up: TrendingUp,
  down: TrendingDown,
  sideways: ArrowRight,
};

const directionColor = {
  up: "text-green-600 dark:text-green-400",
  down: "text-red-600 dark:text-red-400",
  sideways: "text-[color:var(--text-muted)]",
};

export default function TrendAnalysisCard({ data }: { data: TrendData }) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Trend Analysis</h3>

      <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {data.summary}
      </p>

      <div className="space-y-3">
        {data.tokens.map((token, i) => {
          const Icon = directionIcon[token.direction];
          return (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <div className={cn("p-1.5 rounded-lg", directionColor[token.direction])} style={{ backgroundColor: 'var(--bg-card)' }}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {token.symbol}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      token.changePercent >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {token.changePercent >= 0 ? "+" : ""}
                    {token.changePercent.toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                  {token.insight}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
