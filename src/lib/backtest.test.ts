import { describe, it, expect } from "vitest";
import { simulateBacktest } from "./backtest";

// Build a daily YYYY-MM-DD price map starting 2025-01-01.
function series(
  days: { stxUsd: number; btcUsd: number }[],
): Map<string, { stxUsd: number; btcUsd: number }> {
  const m = new Map<string, { stxUsd: number; btcUsd: number }>();
  const start = Date.parse("2025-01-01T00:00:00Z");
  days.forEach((d, i) => {
    const iso = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    m.set(iso, d);
  });
  return m;
}

describe("simulateBacktest", () => {
  it("accumulates one buy per interval at the period price", () => {
    const prices = series(Array(15).fill({ stxUsd: 2, btcUsd: 100_000 }));
    const r = simulateBacktest(
      { amountStx: 50, intervalDays: 7, lookbackDays: 15 },
      prices,
    )!;
    expect(r.swaps).toBe(3);
    expect(r.totalStxIn).toBe(150);
    expect(r.totalSbtcOut).toBeCloseTo(0.003, 8);
    expect(r.startDate).toBe("2025-01-01");
    expect(r.currentValueUsd).toBeCloseTo(300, 6);
    expect(r.vsLump!.deltaPct).toBeCloseTo(0, 6);
  });

  it("reports a positive vs-lump delta when BTC falls after the start", () => {
    const days = Array.from({ length: 15 }, (_, i) => ({
      stxUsd: 2,
      btcUsd: i < 7 ? 100_000 : 50_000,
    }));
    const r = simulateBacktest(
      { amountStx: 50, intervalDays: 7, lookbackDays: 15 },
      series(days),
    )!;
    expect(r.totalSbtcOut).toBeCloseTo(0.005, 8);
    expect(r.vsLump!.deltaPct).toBeGreaterThan(0);
  });

  it("returns null when the series is too small to make a claim", () => {
    expect(simulateBacktest({ amountStx: 50, intervalDays: 7, lookbackDays: 15 }, new Map())).toBeNull();
    expect(
      simulateBacktest(
        { amountStx: 50, intervalDays: 7, lookbackDays: 15 },
        series([{ stxUsd: 2, btcUsd: 100_000 }]),
      ),
    ).toBeNull();
  });
});
