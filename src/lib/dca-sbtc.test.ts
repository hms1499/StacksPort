import { describe, it, expect } from "vitest";
import {
  aggregateSBTCPlanPerformance,
  blocksToInterval,
  satsToBTC,
  btcToSats,
  type SBTCPlanExecutionEvent,
} from "./dca-sbtc";

const TGT = "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx";

function ev(
  partial: Partial<SBTCPlanExecutionEvent>
): SBTCPlanExecutionEvent {
  return {
    txId: "0xabc",
    blockHeight: 1,
    blockTime: 1_700_000_000,
    status: "success",
    sbtcIn: 100_000,    // 0.001 sBTC = 100k sats
    tokenOut: 50_000_000, // 50 USDCx (6 decimals)
    targetTokenContract: TGT,
    ...partial,
  };
}

describe("aggregateSBTCPlanPerformance", () => {
  it("returns zeros when no events", () => {
    const r = aggregateSBTCPlanPerformance(1, []);
    expect(r.executionCount).toBe(0);
    expect(r.totalSbtcIn).toBe(0);
    expect(r.totalTokenOut).toBe(0);
    expect(r.avgSbtcPerToken).toBe(0);
    expect(r.avgTokenPerSbtc).toBe(0);
    expect(r.firstExecutionAt).toBeNull();
    expect(r.lastExecutionAt).toBeNull();
    expect(r.targetTokenContract).toBeNull();
  });

  it("counts only successful events and ignores non-success from totals", () => {
    const events = [
      ev({ blockTime: 1_700_000_100 }),
      ev({ status: "pending", sbtcIn: undefined, tokenOut: undefined, blockTime: 0 }),
      ev({ status: "failed", sbtcIn: undefined, tokenOut: undefined, blockTime: 1_700_000_200 }),
    ];
    const r = aggregateSBTCPlanPerformance(7, events);
    expect(r.executionCount).toBe(1);
    expect(r.totalSbtcIn).toBe(100_000);
    expect(r.totalTokenOut).toBe(50);
    expect(r.successfulEvents).toHaveLength(1);
  });

  it("aggregates totals and averages across successful events", () => {
    const events = [
      ev({ sbtcIn: 100_000, tokenOut: 50_000_000, blockTime: 1_700_000_100 }),
      ev({ sbtcIn: 100_000, tokenOut: 60_000_000, blockTime: 1_700_000_200 }),
    ];
    const r = aggregateSBTCPlanPerformance(7, events);
    expect(r.totalSbtcIn).toBe(200_000);                  // sats
    expect(r.totalTokenOut).toBe(110);                    // 110 USDCx in base units (6 dp)
    expect(r.avgSbtcPerToken).toBeCloseTo(200_000 / 110); // sats per USDCx
    expect(r.avgTokenPerSbtc).toBeCloseTo(110 / 0.002);   // USDCx per 1 sBTC (0.002 = 200k sats)
    expect(r.firstExecutionAt).toBe(1_700_000_100);
    expect(r.lastExecutionAt).toBe(1_700_000_200);
    expect(r.targetTokenContract).toBe(TGT);
  });

  it("scales target-token units by decimals (default 6)", () => {
    const r = aggregateSBTCPlanPerformance(
      1,
      [ev({ tokenOut: 1_234_567_890 })]
    );
    expect(r.totalTokenOut).toBeCloseTo(1234.56789);
  });

  it("respects custom targetTokenDecimals override", () => {
    const r = aggregateSBTCPlanPerformance(
      1,
      [ev({ tokenOut: 1_234_567_890 })],
      8
    );
    expect(r.totalTokenOut).toBeCloseTo(12.3456789);
  });
});

describe("blocksToInterval (sBTC)", () => {
  it.each([
    [650, "Daily"],
    [4550, "Weekly"],
    [19500, "Monthly"],
    [1300, "Daily (v2)"],
    [9100, "Weekly (v2)"],
    [39000, "Monthly (v2)"],
    [9360, "Daily (legacy)"],
    [65520, "Weekly (legacy)"],
    [280800, "Monthly (legacy)"],
    [144, "Daily (v1)"],
    [1008, "Weekly (v1)"],
    [4320, "Monthly (v1)"],
  ])("maps %i blocks to %s", (blocks, label) => {
    expect(blocksToInterval(blocks)).toBe(label);
  });
  it("falls back to '<n> blocks' for unknown values", () => {
    expect(blocksToInterval(999)).toBe("999 blocks");
  });
});

describe("satsToBTC", () => {
  it("converts sats to BTC at 8 decimals", () => {
    expect(satsToBTC(150_000_000)).toBe(1.5);
  });
  it("returns 0 for 0", () => {
    expect(satsToBTC(0)).toBe(0);
  });
});

describe("btcToSats", () => {
  it("converts BTC to sats at 8 decimals", () => {
    expect(btcToSats(1.5)).toBe(150_000_000);
  });
  // CHARACTERIZED: Math.floor drops sub-sat dust (5e-9 BTC -> 0).
  it("floors sub-sat amounts to zero (dust loss)", () => {
    expect(btcToSats(0.000000005)).toBe(0);
  });
  it("round-trips with satsToBTC", () => {
    expect(satsToBTC(btcToSats(2.5))).toBe(2.5);
  });
});
