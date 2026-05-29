import { describe, it, expect } from "vitest";
import {
  aggregateSBTCPlanPerformance,
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
