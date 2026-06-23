import { describe, expect, it } from "vitest";
import {
  sbtcToSats, satsToSbtc, MIN_SUPPLY_SATS,
  validateSupplyAmount, validateWithdrawAmount, estimateZTokenReceived,
} from "./amount";

describe("zest amount", () => {
  it("converts sBTC <-> sats with 8 decimals", () => {
    expect(sbtcToSats(0.001)).toBe(100_000);
    expect(satsToSbtc(100_000)).toBe(0.001);
    expect(sbtcToSats(0.00000001)).toBe(1);
  });

  it("validates supply: zero, below-min, insufficient, ok", () => {
    expect(validateSupplyAmount(0, 1_000_000)).toEqual({ ok: false, reason: "zero" });
    expect(validateSupplyAmount(MIN_SUPPLY_SATS - 1, 1_000_000))
      .toEqual({ ok: false, reason: "below-min" });
    expect(validateSupplyAmount(2_000_000, 1_000_000))
      .toEqual({ ok: false, reason: "insufficient" });
    expect(validateSupplyAmount(500_000, 1_000_000)).toEqual({ ok: true });
  });

  it("validates withdraw: zero, exceeds-supplied, ok", () => {
    expect(validateWithdrawAmount(0, 500_000)).toEqual({ ok: false, reason: "zero" });
    expect(validateWithdrawAmount(600_000, 500_000))
      .toEqual({ ok: false, reason: "exceeds-supplied" });
    expect(validateWithdrawAmount(500_000, 500_000)).toEqual({ ok: true });
  });

  it("estimates z-token ~1:1 with underlying", () => {
    expect(estimateZTokenReceived(123_456)).toBe(123_456);
  });
});
