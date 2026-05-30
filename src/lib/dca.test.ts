import { describe, it, expect } from "vitest";
import {
  microToToken,
  tokenToMicro,
  microToSTX,
  stxToMicro,
  blocksToInterval,
  utcIsoDateFromUnix,
  computeLumpSum,
} from "./dca";

describe("microToToken", () => {
  it("converts micro to token at default 6 decimals", () => {
    expect(microToToken(1_500_000)).toBe(1.5);
  });
  it("honors an explicit decimals argument (8dp)", () => {
    expect(microToToken(150_000_000, 8)).toBe(1.5);
  });
  it("returns 0 for 0", () => {
    expect(microToToken(0)).toBe(0);
  });
  it("represents a single micro-unit at 6dp", () => {
    expect(microToToken(1)).toBeCloseTo(0.000001, 12);
  });
});

describe("tokenToMicro", () => {
  it("converts token to micro at default 6 decimals", () => {
    expect(tokenToMicro(1.5)).toBe(1_500_000);
  });
  it("honors an explicit decimals argument (8dp)", () => {
    expect(tokenToMicro(1.5, 8)).toBe(150_000_000);
  });
  // CHARACTERIZED: Math.floor drops sub-micro dust (0.0000005 STX -> 0).
  it("floors sub-micro amounts to zero (dust loss)", () => {
    expect(tokenToMicro(0.0000005)).toBe(0);
  });
  it("round-trips with microToToken", () => {
    expect(microToToken(tokenToMicro(2.5))).toBe(2.5);
  });
});

describe("microToSTX / stxToMicro", () => {
  it("microToSTX converts at 6 decimals", () => {
    expect(microToSTX(2_000_000)).toBe(2);
  });
  it("stxToMicro converts at 6 decimals", () => {
    expect(stxToMicro(2)).toBe(2_000_000);
  });
  it("round-trips", () => {
    expect(microToSTX(stxToMicro(3.25))).toBe(3.25);
  });
});

describe("blocksToInterval", () => {
  it.each([
    [650, "Daily"],
    [4550, "Weekly"],
    [19500, "Monthly"],
    [1300, "Daily (v2)"],
    [9100, "Weekly (v2)"],
    [39000, "Monthly (v2)"],
    [9360, "Daily (legacy)"],
    [65520, "Weekly (legacy)"],
    [280800, "Monthly (legacy)"],
    [144, "Daily (v1)"],
    [1008, "Weekly (v1)"],
    [4320, "Monthly (v1)"],
  ])("maps %i blocks to %s", (blocks, label) => {
    expect(blocksToInterval(blocks)).toBe(label);
  });
  it("falls back to '<n> blocks' for unknown values", () => {
    expect(blocksToInterval(999)).toBe("999 blocks");
  });
  it("formats zero as '0 blocks'", () => {
    expect(blocksToInterval(0)).toBe("0 blocks");
  });
});

describe("utcIsoDateFromUnix", () => {
  it("formats the unix epoch as 1970-01-01", () => {
    expect(utcIsoDateFromUnix(0)).toBe("1970-01-01");
  });
  it("formats a known timestamp in UTC", () => {
    // 1700000000 = 2023-11-14T22:13:20Z
    expect(utcIsoDateFromUnix(1700000000)).toBe("2023-11-14");
  });
  it("zero-pads single-digit month and day", () => {
    // 1704067200 = 2024-01-01T00:00:00Z
    expect(utcIsoDateFromUnix(1704067200)).toBe("2024-01-01");
  });
});

describe("computeLumpSum", () => {
  const perf = { totalStxIn: 100, totalSbtcOut: 0.01 };

  it("computes the lump-sum counterfactual and delta", () => {
    const r = computeLumpSum(perf, "2024-01-01", 2, 50000);
    expect(r).not.toBeNull();
    // usdAvailable = 100 * 2 = 200; lumpSumSbtc = 200 / 50000 = 0.004
    expect(r!.lumpSumSbtc).toBeCloseTo(0.004, 9);
    // deltaSbtc = 0.01 - 0.004 = 0.006
    expect(r!.deltaSbtc).toBeCloseTo(0.006, 9);
    // deltaPct = (0.006 / 0.004) * 100 = 150
    expect(r!.deltaPct).toBeCloseTo(150, 6);
    expect(r!.referenceDate).toBe("2024-01-01");
    expect(r!.stxUsdAtRef).toBe(2);
    expect(r!.btcUsdAtRef).toBe(50000);
  });

  it("returns null when stxUsdAtRef <= 0", () => {
    expect(computeLumpSum(perf, "2024-01-01", 0, 50000)).toBeNull();
  });
  it("returns null when btcUsdAtRef <= 0", () => {
    expect(computeLumpSum(perf, "2024-01-01", 2, 0)).toBeNull();
  });
  it("returns null when totalStxIn <= 0", () => {
    expect(
      computeLumpSum({ totalStxIn: 0, totalSbtcOut: 0.01 }, "2024-01-01", 2, 50000)
    ).toBeNull();
  });
});
