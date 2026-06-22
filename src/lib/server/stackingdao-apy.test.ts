import { describe, expect, it } from "vitest";
import { parseStackingApy } from "./stackingdao-apy";

describe("parseStackingApy", () => {
  it("parses a plain numeric body", () => {
    expect(parseStackingApy("3.92")).toBe(3.92);
    expect(parseStackingApy("  7  ")).toBe(7);
  });

  it("returns null for non-numeric, non-positive, or absurd values", () => {
    expect(parseStackingApy("not-a-number")).toBeNull();
    expect(parseStackingApy("")).toBeNull();
    expect(parseStackingApy("0")).toBeNull();
    expect(parseStackingApy("-5")).toBeNull();
    expect(parseStackingApy("250")).toBeNull(); // > 100% guard
  });
});
