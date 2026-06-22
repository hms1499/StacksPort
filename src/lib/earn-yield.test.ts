import { describe, expect, it } from "vitest";
import { estimateAnnualYield } from "./earn-yield";
import type { ProtocolPosition } from "./protocol-positions";
import type { YieldSnapshot } from "./server/yield-snapshot";

const snap: YieldSnapshot = {
  generatedAt: 0,
  stackingApy: 4, // 4%
  zest: { USDC: 2 }, // 2%
  sources: { stackingDao: "ok", zest: "ok" },
};

const positions = new Map<string, ProtocolPosition | null>([
  ["StackingDAO", { lines: [{ label: "Staked", tokenAmount: "100.00 STX", usdValue: 200 }], totalUsd: 200 }],
  ["Zest Protocol", { lines: [{ label: "Supplied", tokenAmount: "500.00 USDC", usdValue: 500 }], totalUsd: 500 }],
  ["Lisa", { lines: [{ label: "Staked", tokenAmount: "50.00 STX", usdValue: 100 }], totalUsd: 100 }],
  ["Arkadiko", null],
]);

describe("estimateAnnualYield", () => {
  it("sums value at work and applies APY only where known", () => {
    const r = estimateAnnualYield(positions, snap);
    expect(r.totalAtWork).toBe(800); // 200 + 500 + 100
    // StackingDAO: 200 * 4% = 8 ; Zest USDC: 500 * 2% = 10 ; Lisa: no apy
    expect(r.annualYield).toBeCloseTo(18, 6);
  });

  it("returns null annualYield when no APY is known", () => {
    const r = estimateAnnualYield(positions, undefined);
    expect(r.totalAtWork).toBe(800);
    expect(r.annualYield).toBeNull();
  });

  it("handles an empty map", () => {
    expect(estimateAnnualYield(new Map(), snap)).toEqual({ totalAtWork: 0, annualYield: null });
  });
});
