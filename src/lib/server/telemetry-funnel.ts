// Pure helpers for the activation-funnel read endpoint. The raw data is a set
// of per-day Redis counters (`telemetry:<event>:<YYYY-MM-DD>`); this module
// turns a window of dates + a flat count lookup into a viewable report. Pure
// and I/O-free so it can be unit-tested without Redis.

// The activation funnel, in order. `dashboard_viewed` is the top; each later
// step is a deeper commitment. `backtest_cta_clicked` attributes connects to
// the pre-connect backtest hero (does Bet #1 convert?).
export const FUNNEL_EVENTS = [
  "dashboard_viewed",
  "wallet_connected",
  "backtest_cta_clicked",
  "dca_plan_created",
  "swap_executed",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export interface FunnelReport {
  days: number;
  totals: Record<FunnelEvent, number>;
  daily: Array<{ date: string } & Record<FunnelEvent, number>>;
}

/** The last `n` calendar dates (UTC, YYYY-MM-DD) ending at `today`, ascending. */
export function lastNDates(n: number, today: Date = new Date()): string[] {
  const base = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(base - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Build the report from a window of dates and a `"<event>:<date>" -> count`
 * lookup. Missing entries are treated as 0, so every event/day cell is present.
 */
export function assembleFunnel(
  dates: string[],
  counts: Map<string, number>,
): FunnelReport {
  const totals = Object.fromEntries(
    FUNNEL_EVENTS.map((e) => [e, 0]),
  ) as Record<FunnelEvent, number>;

  const daily = dates.map((date) => {
    const row = { date } as { date: string } & Record<FunnelEvent, number>;
    for (const e of FUNNEL_EVENTS) {
      const c = counts.get(`${e}:${date}`) ?? 0;
      row[e] = c;
      totals[e] += c;
    }
    return row;
  });

  return { days: dates.length, totals, daily };
}
