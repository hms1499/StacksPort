import { describe, it, expect } from "vitest";
import { pairRateSeries, pctChange } from "./swap-chart";

describe("pairRateSeries", () => {
  it("element-wise from/to for equal-length inputs", () => {
    expect(pairRateSeries([100, 120], [50, 60])).toEqual([2, 2]);
  });

  it("aligns from the END when lengths differ (keeps most recent)", () => {
    // older extra leading point on `from` is trimmed
    expect(pairRateSeries([999, 100, 120], [50, 60])).toEqual([2, 2]);
  });

  it("drops points with a non-positive or non-finite price on either side", () => {
    expect(pairRateSeries([100, 0, 120], [50, 60, 60])).toEqual([2, 2]);
    expect(pairRateSeries([100, NaN], [50, 60])).toEqual([2]);
    expect(pairRateSeries([100, 120], [50, 0])).toEqual([2]);
  });

  it("empty when either input is empty", () => {
    expect(pairRateSeries([], [1, 2])).toEqual([]);
    expect(pairRateSeries([1, 2], [])).toEqual([]);
  });

  it("handles a synthesised flat stablecoin series (to = all 1s)", () => {
    expect(pairRateSeries([2, 3, 4], [1, 1, 1])).toEqual([2, 3, 4]);
  });
});

describe("pctChange", () => {
  it("first → last percent", () => {
    expect(pctChange([100, 110])).toBeCloseTo(10);
    expect(pctChange([100, 90])).toBeCloseTo(-10);
  });

  it("uses endpoints, ignores the middle", () => {
    expect(pctChange([100, 999, 50])).toBeCloseTo(-50);
  });

  it("null when fewer than 2 points", () => {
    expect(pctChange([])).toBeNull();
    expect(pctChange([100])).toBeNull();
  });

  it("null when the first point is non-positive", () => {
    expect(pctChange([0, 100])).toBeNull();
  });
});
