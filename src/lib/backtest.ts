// Pure DCA backtest over a historical STX/BTC daily price series. No I/O —
// the caller supplies the prices so this stays deterministic and unit-testable.
import { computeLumpSum, type LumpSumScenario } from "./dca";

export interface BacktestParams {
  amountStx: number;     // STX spent per interval
  intervalDays: number;  // cadence in days
  lookbackDays: number;  // window length (informational; the series defines the range)
}

export interface BacktestResult {
  totalStxIn: number;
  totalSbtcOut: number;
  swaps: number;
  startDate: string;        // YYYY-MM-DD of first buy
  currentBtcUsd: number;    // BTC/USD at the latest series point
  currentValueUsd: number;  // totalSbtcOut * currentBtcUsd
  costUsd: number;          // total USD spent across buys (Σ amountStx * stxUsd at each buy)
  growthPct: number;        // (currentValueUsd - costUsd) / costUsd * 100
  vsLump: LumpSumScenario | null;
}

type Price = { stxUsd: number; btcUsd: number };

// Greatest date <= iso that has a price point (covers gaps/weekends in the feed).
function priceOnOrBefore(series: Map<string, Price>, iso: string): Price | undefined {
  let best: string | undefined;
  for (const d of series.keys()) {
    if (d <= iso && (best === undefined || d > best)) best = d;
  }
  return best ? series.get(best) : undefined;
}

export function simulateBacktest(
  params: BacktestParams,
  priceSeries: Map<string, Price>,
): BacktestResult | null {
  const dates = [...priceSeries.keys()].sort(); // ascending YYYY-MM-DD
  if (dates.length < 2) return null;

  const start = dates[0];
  const end = dates[dates.length - 1];
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  const stepMs = params.intervalDays * 86_400_000;

  let totalStxIn = 0;
  let totalSbtcOut = 0;
  let costUsd = 0;
  let swaps = 0;
  let firstBuy: Price | null = null;
  let firstBuyDate: string | null = null;

  for (let ms = startMs; ms <= endMs; ms += stepMs) {
    const iso = new Date(ms).toISOString().slice(0, 10);
    const price = priceSeries.get(iso) ?? priceOnOrBefore(priceSeries, iso);
    if (!price) continue;
    if (!firstBuy) { firstBuy = price; firstBuyDate = iso; }
    totalSbtcOut += (params.amountStx * price.stxUsd) / price.btcUsd;
    costUsd += params.amountStx * price.stxUsd;
    totalStxIn += params.amountStx;
    swaps += 1;
  }

  if (swaps === 0 || totalStxIn <= 0 || !firstBuy) return null;

  // end came from priceSeries.keys(), so it is always present.
  const currentBtcUsd = priceSeries.get(end)!.btcUsd;
  const currentValueUsd = totalSbtcOut * currentBtcUsd;
  const vsLump = computeLumpSum(
    { totalStxIn, totalSbtcOut },
    firstBuyDate!,
    firstBuy.stxUsd,
    firstBuy.btcUsd,
  );

  return {
    totalStxIn,
    totalSbtcOut,
    swaps,
    startDate: start,
    currentBtcUsd,
    currentValueUsd,
    costUsd,
    growthPct: costUsd > 0 ? ((currentValueUsd - costUsd) / costUsd) * 100 : 0,
    vsLump,
  };
}
