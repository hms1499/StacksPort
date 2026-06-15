import { describe, it, expect } from "vitest";
import { lastNDates, assembleFunnel, FUNNEL_EVENTS } from "./telemetry-funnel";

describe("lastNDates", () => {
  it("returns n ascending UTC dates ending at today", () => {
    expect(lastNDates(3, new Date("2026-06-15T10:00:00Z"))).toEqual([
      "2026-06-13",
      "2026-06-14",
      "2026-06-15",
    ]);
  });

  it("returns a single date for n=1", () => {
    expect(lastNDates(1, new Date("2026-06-15T23:59:59Z"))).toEqual(["2026-06-15"]);
  });
});

describe("assembleFunnel", () => {
  it("sums per-event totals and fills missing cells with 0", () => {
    const dates = ["2026-06-14", "2026-06-15"];
    const counts = new Map<string, number>([
      ["wallet_connected:2026-06-14", 3],
      ["wallet_connected:2026-06-15", 2],
      ["dca_plan_created:2026-06-15", 1],
    ]);

    const r = assembleFunnel(dates, counts);

    expect(r.days).toBe(2);
    expect(r.totals.wallet_connected).toBe(5);
    expect(r.totals.dca_plan_created).toBe(1);
    expect(r.totals.swap_executed).toBe(0); // no data → 0, not undefined
    expect(r.daily[0]).toEqual({
      date: "2026-06-14",
      dashboard_viewed: 0,
      wallet_connected: 3,
      backtest_cta_clicked: 0,
      dca_plan_created: 0,
      swap_executed: 0,
    });
    expect(r.daily[1].dca_plan_created).toBe(1);
  });

  it("covers every funnel event in totals even with empty data", () => {
    const r = assembleFunnel(["2026-06-15"], new Map());
    for (const e of FUNNEL_EVENTS) expect(r.totals[e]).toBe(0);
  });
});
