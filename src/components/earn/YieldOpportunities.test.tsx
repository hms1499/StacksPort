import { describe, expect, it } from "vitest";
import { stackingApyLabel } from "./YieldOpportunities";

describe("stackingApyLabel", () => {
  it("uses the live APY when available", () => {
    expect(stackingApyLabel(3.92, [7, 9])).toBe("~3.9%");
  });

  it("falls back to the hardcoded estimate range when live is undefined", () => {
    expect(stackingApyLabel(undefined, [7, 9])).toBe("7–9%");
  });
});
