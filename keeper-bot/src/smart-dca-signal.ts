// keeper-bot/src/smart-dca-signal.ts
// Builds the sats/STX signal from CoinGecko daily market charts. Fail-open:
// any error returns null and the caller treats every plan as configless.
import { computeSatsPerStxSeries, type SatsPerStxSignal } from "./smart-dca.js";
import { log } from "./logger.js";

const CG = "https://api.coingecko.com/api/v3";

async function fetchDailyUsd(coin: string, days: number): Promise<number[]> {
  const res = await fetch(
    `${CG}/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`coingecko ${coin} ${res.status}`);
  const data = (await res.json()) as { prices: [number, number][] };
  return (data.prices ?? []).map(([, v]) => v);
}

// maxDays should cover the largest windowDays across all configs (cap 30).
export async function fetchSatsPerStxSignal(
  maxDays: number
): Promise<SatsPerStxSignal | null> {
  try {
    const days = Math.max(1, Math.min(maxDays, 30));
    const [stx, btc] = await Promise.all([
      fetchDailyUsd("blockstack", days),
      fetchDailyUsd("bitcoin", days),
    ]);
    const series = computeSatsPerStxSeries(stx, btc);
    if (series.length === 0) {
      log.warn("smart-dca signal: empty series, failing open");
      return null;
    }
    return { current: series[series.length - 1], series };
  } catch (err) {
    log.warn("smart-dca signal fetch failed, failing open", { err: String(err) });
    return null;
  }
}
