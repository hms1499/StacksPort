import { describe, it, expect } from "vitest";
import { validateLimitOrder, usdToMicro, microToUsd, MIN_DEPOSIT_USTX, MAX_OPEN_ORDERS } from "./limit-orders";

describe("limit-orders validation", () => {
  it("accepts a valid order", () => {
    const r = validateLimitOrder({ depositStx: 5, targetUsd: 60000, openOrderCount: 0 });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects a deposit below the 2 STX minimum", () => {
    const r = validateLimitOrder({ depositStx: 1, targetUsd: 60000, openOrderCount: 0 });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("rejects a non-positive target price", () => {
    const r = validateLimitOrder({ depositStx: 5, targetUsd: 0, openOrderCount: 0 });
    expect(r.ok).toBe(false);
  });

  it("rejects when the open-order cap is reached", () => {
    const r = validateLimitOrder({ depositStx: 5, targetUsd: 60000, openOrderCount: MAX_OPEN_ORDERS });
    expect(r.ok).toBe(false);
  });

  it("round-trips USD <-> micro-USD", () => {
    expect(usdToMicro(60000)).toBe(60_000_000_000);
    expect(microToUsd(60_000_000_000)).toBe(60000);
  });

  it("exposes the 2 STX minimum in uSTX", () => {
    expect(MIN_DEPOSIT_USTX).toBe(2_000_000);
  });
});
