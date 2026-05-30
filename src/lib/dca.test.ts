import { describe, it, expect } from "vitest";
import {
  microToToken,
  tokenToMicro,
  microToSTX,
  stxToMicro,
  blocksToInterval,
  utcIsoDateFromUnix,
  computeLumpSum,
  aggregatePlanPerformance,
  type PlanExecutionEvent,
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

function ev(partial: Partial<PlanExecutionEvent>): PlanExecutionEvent {
  return {
    txId: "0xabc",
    blockHeight: 1,
    blockTime: 1_700_000_000,
    status: "success",
    netSwapped: 10_000_000,   // 10 STX in micro-STX
    protocolFee: 100_000,     // 0.1 STX
    sbtcReceived: 20_000,     // sats
    ...partial,
  };
}

describe("aggregatePlanPerformance", () => {
  it("returns zeros and null timestamps when there are no events", () => {
    const r = aggregatePlanPerformance(1, []);
    expect(r).toEqual({
      planId: 1,
      executionCount: 0,
      totalStxIn: 0,
      totalSbtcOut: 0,
      avgStxPerSbtc: 0,
      totalFeeStx: 0,
      firstExecutionAt: null,
      lastExecutionAt: null,
      successfulEvents: [],
    });
  });

  it("ignores non-success events and events missing sbtc/netSwapped", () => {
    const events = [
      ev({ status: "failed", blockTime: 50 }),
      ev({ status: "success", sbtcReceived: 0, blockTime: 60 }),
      ev({ status: "success", netSwapped: undefined, blockTime: 70 }),
      ev({ status: "success", blockTime: 100, netSwapped: 5_000_000, sbtcReceived: 10_000, protocolFee: 50_000 }),
    ];
    const r = aggregatePlanPerformance(7, events);
    expect(r.executionCount).toBe(1);
    expect(r.successfulEvents).toHaveLength(1);
    expect(r.successfulEvents[0].blockTime).toBe(100);
  });

  it("sums, sorts ascending by blockTime, and converts units", () => {
    const events = [
      ev({ blockTime: 200, netSwapped: 10_000_000, sbtcReceived: 20_000, protocolFee: 100_000 }),
      ev({ blockTime: 100, netSwapped: 5_000_000, sbtcReceived: 10_000, protocolFee: 50_000 }),
    ];
    const r = aggregatePlanPerformance(3, events);
    expect(r.executionCount).toBe(2);
    // 15_000_000 micro-STX -> 15 STX
    expect(r.totalStxIn).toBeCloseTo(15, 9);
    // 30_000 sats -> 0.0003 sBTC
    expect(r.totalSbtcOut).toBeCloseTo(0.0003, 9);
    // 150_000 micro-STX fee -> 0.15 STX
    expect(r.totalFeeStx).toBeCloseTo(0.15, 9);
    // 15 / 0.0003 = 50000
    expect(r.avgStxPerSbtc).toBeCloseTo(50000, 3);
    expect(r.firstExecutionAt).toBe(100);
    expect(r.lastExecutionAt).toBe(200);
    expect(r.successfulEvents.map((e) => e.blockTime)).toEqual([100, 200]);
  });
});
