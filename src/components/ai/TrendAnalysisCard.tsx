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
  sideways: "text-gray-500 dark:text-gray-400",
};

export default function TrendAnalysisCard({ data }: { data: TrendData }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Trend Analysis</h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
        {data.summary}
      </p>

      <div className="space-y-3">
        {data.tokens.map((token, i) => {
          const Icon = directionIcon[token.direction];
          return (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl"
            >
              <div className={cn("p-1.5 rounded-lg bg-white dark:bg-gray-800", directionColor[token.direction])}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
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
