import { describe, it, expect } from "vitest";
import { aggregateStxUsdcxPlanPerformance, type StxUsdcxExecutionEvent } from "./dca-stx-usdcx";

describe("aggregateStxUsdcxPlanPerformance", () => {
  it("computes avg USDCx per STX from successful events", () => {
    const events: StxUsdcxExecutionEvent[] = [
      { txId: "a", blockHeight: 1, blockTime: 100, status: "success", stxIn: 2_000_000, tokenOut: 1_500_000 },
      { txId: "b", blockHeight: 2, blockTime: 200, status: "success", stxIn: 2_000_000, tokenOut: 1_600_000 },
    ];
    const p = aggregateStxUsdcxPlanPerformance(1, events, 6);
    expect(p.executionCount).toBe(2);
    expect(p.totalStxIn).toBe(4_000_000);       // uSTX
    expect(p.totalTokenOut).toBeCloseTo(3.1);   // (1.5 + 1.6) USDCx
    expect(p.avgTokenPerStx).toBeCloseTo(3.1 / 4); // tokens per 1 STX (4 STX in)
  });
});
