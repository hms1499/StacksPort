// src/lib/domain/stacking/amount.test.ts
import { describe, it, expect } from "vitest";
import { idleStx, validateStakeAmount, estimateStStxReceived } from "./amount";

describe("idleStx", () => {
  it("subtracts the fee buffer from the unlocked balance", () => {
    expect(idleStx(2_000_000)).toBe(1_500_000); // 2 STX - 0.5 buffer
  });
  it("never returns negative", () => {
    expect(idleStx(100_000)).toBe(0);
  });
});

describe("validateStakeAmount", () => {
  it("rejects amounts below the minimum", () => {
    expect(validateStakeAmount(500_000, 10_000_000)).toEqual({ ok: false, reason: "below-min" });
  });
  it("rejects amounts above the available balance", () => {
    expect(validateStakeAmount(11_000_000, 10_000_000)).toEqual({ ok: false, reason: "exceeds-balance" });
  });
  it("accepts a valid amount", () => {
    expect(validateStakeAmount(5_000_000, 10_000_000)).toEqual({ ok: true });
  });
});

describe("estimateStStxReceived", () => {
  it("returns floored micro-stSTX given the micro-STX-per-stSTX rate", () => {
    // 10 STX at a rate of 1.25 STX per stSTX -> 8 stSTX
    expect(estimateStStxReceived(10_000_000, 1_250_000)).toBe(8_000_000);
  });
  it("returns 0 for a non-positive rate", () => {
    expect(estimateStStxReceived(10_000_000, 0)).toBe(0);
  });
});
