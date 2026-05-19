// src/lib/swap-chart.ts
// Pure transforms for the swap-pair mini chart. No I/O — fed by raw CoinGecko
// USD price arrays (oldest → newest) and consumed by the sparkline UI.

/**
 * Exchange-rate series for a pair: how many `to` units 1 `from` unit buys at
 * each point (`fromUsd / toUsd`). The two inputs may differ in length (a fixed
 * stablecoin synthesises its own series); they are aligned from the END so the
 * most recent points line up, and any point with a non-finite or non-positive
 * price on either side is dropped (the chart skips gaps rather than spiking).
 */
export function pairRateSeries(
  fromUsd: number[],
  toUsd: number[]
): number[] {
  const n = Math.min(fromUsd.length, toUsd.length);
  if (n === 0) return [];
  const fStart = fromUsd.length - n;
  const tStart = toUsd.length - n;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const f = fromUsd[fStart + i];
    const t = toUsd[tStart + i];
    if (Number.isFinite(f) && Number.isFinite(t) && f > 0 && t > 0) {
      out.push(f / t);
    }
  }
  return out;
}

/**
 * Percent change across a series (first → last). `null` when it can't be
 * computed (fewer than 2 points, or a non-positive/!finite endpoint) so the UI
 * hides the figure instead of showing NaN/Infinity.
 */
export function pctChange(series: number[]): number | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (!(first > 0) || !Number.isFinite(last)) return null;
  return ((last - first) / first) * 100;
}
