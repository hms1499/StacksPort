// src/lib/server/portfolio-signals.test.ts
import { describe, it, expect } from "vitest";
import { detectSignals, type SignalInput } from "./portfolio-signals";
import type { DCAPlan } from "@/lib/dca";
import type { PnLData, SBTCData } from "@/lib/stacks";

function plan(over: Partial<DCAPlan>): DCAPlan {
  return {
    id: 1, owner: "SP", token: "tok", amt: 1_000_000, ivl: 4550, leb: 0,
    bal: 10_000_000, tsd: 0, tss: 0, active: true, cat: 0, ...over,
  };
}
const empty: SignalInput = { dcaPlans: null, pnl: null, sbtcData: null, fearGreed: null };

describe("detectSignals", () => {
  it("returns [] when everything is absent", () => {
    expect(detectSignals(empty)).toEqual([]);
  });

  it("flags dca-runway-low when ≤3 swaps remain, with day math", () => {
    // bal/amt = 3 swaps; ivl 4550 → days = 3*4550/9360 ≈ 1.5
    const s = detectSignals({ ...empty, dcaPlans: [plan({ id: 7, amt: 1_000_000, bal: 3_000_000, ivl: 4550 })] });
    const sig = s.find((x) => x.kind === "dca-runway-low");
    expect(sig).toBeTruthy();
    expect(sig!.facts.planId).toBe(7);
    expect(sig!.facts.swapsLeft).toBe(3);
    expect(sig!.facts.daysLeft).toBeCloseTo(1.5, 1);
    expect(sig!.severity).toBe("medium");
  });

  it("runway with ≤1 swap is high severity", () => {
    const s = detectSignals({ ...empty, dcaPlans: [plan({ amt: 1_000_000, bal: 1_500_000 })] });
    expect(s.find((x) => x.kind === "dca-runway-low")!.severity).toBe("high");
  });

  it("flags dca-balance-empty (high) when bal < amt, not runway", () => {
    const s = detectSignals({ ...empty, dcaPlans: [plan({ id: 3, amt: 2_000_000, bal: 500_000 })] });
    expect(s.some((x) => x.kind === "dca-runway-low")).toBe(false);
    const sig = s.find((x) => x.kind === "dca-balance-empty");
    expect(sig!.severity).toBe("high");
    expect(sig!.facts.planId).toBe(3);
  });

  it("ignores inactive plans", () => {
    const s = detectSignals({ ...empty, dcaPlans: [plan({ active: false, bal: 0 })] });
    expect(s).toEqual([]);
  });

  it("flags dca-dip-buy only when F&G ≤25 AND an active plan exists", () => {
    const base = { ...empty, dcaPlans: [plan({ bal: 10_000_000 })] };
    expect(detectSignals({ ...base, fearGreed: { value: 20, classification: "Extreme Fear" } })
      .some((x) => x.kind === "dca-dip-buy")).toBe(true);
    expect(detectSignals({ ...base, fearGreed: { value: 60, classification: "Greed" } })
      .some((x) => x.kind === "dca-dip-buy")).toBe(false);
    expect(detectSignals({ ...empty, fearGreed: { value: 10, classification: "Extreme Fear" } })
      .some((x) => x.kind === "dca-dip-buy")).toBe(false);
    // boundary: value === 25 is inclusive, and severity is "low"
    const dip = detectSignals({ ...base, fearGreed: { value: 25, classification: "Extreme Fear" } })
      .find((x) => x.kind === "dca-dip-buy");
    expect(dip!.severity).toBe("low");
  });

  it("does not fire dca-dip-buy when no active plan can fund a swap", () => {
    // active but balance-empty (bal < amt) → can't buy the dip
    const s = detectSignals({
      ...empty,
      dcaPlans: [plan({ amt: 2_000_000, bal: 500_000 })],
      fearGreed: { value: 15, classification: "Extreme Fear" },
    });
    expect(s.some((x) => x.kind === "dca-dip-buy")).toBe(false);
    expect(s.some((x) => x.kind === "dca-balance-empty")).toBe(true);
  });

  it("counts only fundable plans in dca-dip-buy planCount", () => {
    const s = detectSignals({
      ...empty,
      dcaPlans: [
        plan({ id: 1, amt: 1_000_000, bal: 10_000_000 }), // fundable
        plan({ id: 2, amt: 2_000_000, bal: 500_000 }),    // balance-empty
      ],
      fearGreed: { value: 15, classification: "Extreme Fear" },
    });
    expect(s.find((x) => x.kind === "dca-dip-buy")!.facts.planCount).toBe(1);
  });

  it("flags pnl-gain / pnl-loss with thresholds and severity", () => {
    const pnl = (pct: number): PnLData => ({
      entries: [{ contractId: "c", symbol: "ALEX", name: "Alex", currentBalance: 1, currentPrice: 1,
        currentValue: 100, avgCostBasis: 1, totalCost: 80, unrealizedPnL: 25, unrealizedPct: pct,
        realizedPnL: 0, totalPnL: 25 }],
      totalUnrealized: 25, totalRealized: 0, totalPnL: 25,
    });
    expect(detectSignals({ ...empty, pnl: pnl(25) }).find((x) => x.kind === "pnl-gain")!.severity).toBe("low");
    expect(detectSignals({ ...empty, pnl: pnl(60) }).find((x) => x.kind === "pnl-gain")!.severity).toBe("medium");
    expect(detectSignals({ ...empty, pnl: pnl(-25) }).find((x) => x.kind === "pnl-loss")!.severity).toBe("medium");
    expect(detectSignals({ ...empty, pnl: pnl(-50) }).find((x) => x.kind === "pnl-loss")!.severity).toBe("high");
    expect(detectSignals({ ...empty, pnl: pnl(5) })).toEqual([]);
  });

  it("ignores dust holdings (currentValue < 1) for PnL", () => {
    const pnl: PnLData = {
      entries: [{ contractId: "c", symbol: "DUST", name: "Dust", currentBalance: 1, currentPrice: 0,
        currentValue: 0.2, avgCostBasis: 1, totalCost: 1, unrealizedPnL: -1, unrealizedPct: -90, realizedPnL: 0, totalPnL: -1 }],
      totalUnrealized: -1, totalRealized: 0, totalPnL: -1,
    };
    expect(detectSignals({ ...empty, pnl })).toEqual([]);
  });

  it("flags sbtc-depeg only when holding sBTC and not pegged", () => {
    const sbtc = (status: SBTCData["peg"]["status"], balance: number): SBTCData => ({
      balance, valueUsd: balance, bridgeHistory: [],
      peg: { btcPrice: 100000, sbtcPrice: 95000, deviation: -5, status },
    });
    expect(detectSignals({ ...empty, sbtcData: sbtc("depegged", 1000) }).find((x) => x.kind === "sbtc-depeg")!.severity).toBe("high");
    expect(detectSignals({ ...empty, sbtcData: sbtc("slight", 1000) }).find((x) => x.kind === "sbtc-depeg")!.severity).toBe("low");
    expect(detectSignals({ ...empty, sbtcData: sbtc("pegged", 1000) }).some((x) => x.kind === "sbtc-depeg")).toBe(false);
    expect(detectSignals({ ...empty, sbtcData: sbtc("depegged", 0) }).some((x) => x.kind === "sbtc-depeg")).toBe(false);
  });

  it("sorts by severity and caps at 6 signals", () => {
    const plans = Array.from({ length: 10 }, (_, i) => plan({ id: i, amt: 1_000_000, bal: 100_000 })); // all balance-empty (high)
    const out = detectSignals({ ...empty, dcaPlans: plans });
    expect(out.length).toBe(6);
    expect(out.every((x) => x.severity === "high")).toBe(true);
  });

  it("orders higher severity before lower", () => {
    const out = detectSignals({
      ...empty,
      dcaPlans: [
        plan({ id: 1, amt: 2_000_000, bal: 500_000 }),     // balance-empty → high
        plan({ id: 2, amt: 1_000_000, bal: 10_000_000 }),  // fundable → enables dip-buy
      ],
      fearGreed: { value: 10, classification: "Extreme Fear" }, // dip-buy → low
    });
    expect(out[0].severity).toBe("high");
    expect(out.at(-1)!.severity).toBe("low");
  });
});
