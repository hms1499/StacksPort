// Server-only aggregator: runs the fixed showcase backtest over a rolling
// 365-day window. Consumed by the dashboard RSC only. Caching is inherited
// from getHistoricalStxBtcRange's per-fetch revalidate (3600s) plus the
// dashboard page's revalidate.
import { getHistoricalStxBtcRange } from "@/lib/stacks";
import { simulateBacktest, type BacktestResult } from "@/lib/backtest";

// Fixed pre-connect showcase. Re-tune the pitch by editing this one object.
const SHOWCASE = { amountStx: 50, intervalDays: 7, lookbackDays: 365 } as const;

export type { BacktestResult };

export async function getBacktestSnapshot(): Promise<BacktestResult | null> {
  // E2E runs short-circuit so disconnected-dashboard tests stay deterministic
  // (no live CoinGecko dependency; the widget renders nothing).
  if (process.env.E2E === "1") return null;

  const series = await getHistoricalStxBtcRange(SHOWCASE.lookbackDays);
  return simulateBacktest(SHOWCASE, series);
}
