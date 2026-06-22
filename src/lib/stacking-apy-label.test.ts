import { describe, expect, it } from "vitest";
import { stackingApyLabel } from "./stacking-apy-label";

describe("stackingApyLabel", () => {
  it("uses the live APY when available", () => {
    expect(stackingApyLabel(3.92, [7, 9])).toBe("~3.9%");
  });
  it("falls back to the hardcoded estimate range when live is undefined", () => {
    expect(stackingApyLabel(undefined, [7, 9])).toBe("7–9%");
  });
  it("collapses a single-value range to one figure", () => {
    expect(stackingApyLabel(undefined, [8, 8])).toBe("~8%");
  });
});
