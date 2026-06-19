import { describe, it, expect } from "vitest";
import { validateConfigInput, premium } from "./smart-dca";

describe("validateConfigInput", () => {
  const ok = { planId: 1, thresholdBps: 500, windowDays: 7, maxDeferIntervals: 2 };

  it("accepts a valid config", () => {
    expect(validateConfigInput(ok)).toEqual({ ok: true, errors: [] });
  });
  it("rejects thresholdBps out of range", () => {
    const r = validateConfigInput({ ...ok, thresholdBps: 6000 });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("thresholdBps must be 0..5000");
  });
  it("rejects windowDays out of range", () => {
    expect(validateConfigInput({ ...ok, windowDays: 0 }).ok).toBe(false);
    expect(validateConfigInput({ ...ok, windowDays: 31 }).ok).toBe(false);
  });
  it("rejects maxDeferIntervals out of range", () => {
    expect(validateConfigInput({ ...ok, maxDeferIntervals: 11 }).ok).toBe(false);
  });
  it("rejects a non-integer planId", () => {
    expect(validateConfigInput({ ...ok, planId: 1.5 }).ok).toBe(false);
  });
});

describe("premium", () => {
  it("computes current/avg - 1", () => {
    expect(premium(106, 100)).toBeCloseTo(0.06, 9);
  });
  it("returns null when avg <= 0", () => {
    expect(premium(106, 0)).toBeNull();
  });
});
