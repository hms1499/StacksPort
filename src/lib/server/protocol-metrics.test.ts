import { ClarityType, type ClarityValue } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import {
  buildProtocolMetrics,
  parseVaultStats,
  type VaultStats,
} from "./protocol-metrics";

const stxVault: VaultStats = {
  plans: 2,
  volume: 10_000_000,
  executed: 6,
};
const sbtcVault: VaultStats = {
  plans: 1,
  volume: 100_000_000,
  executed: 3,
};

function clarityStats(overrides: Record<string, unknown> = {}): ClarityValue {
  return {
    type: ClarityType.ResponseOk,
    value: {
      type: ClarityType.Tuple,
      value: {
        "total-plans": { type: ClarityType.UInt, value: 2n },
        "total-volume": { type: ClarityType.UInt, value: 10_000_000n },
        "total-executed": { type: ClarityType.UInt, value: 6n },
        ...overrides,
      },
    },
  } as unknown as ClarityValue;
}

describe("parseVaultStats", () => {
  it("parses the expected get-stats tuple", () => {
    expect(parseVaultStats(clarityStats())).toEqual(stxVault);
  });

  it("rejects malformed tuple fields", () => {
    expect(() =>
      parseVaultStats(clarityStats({ "total-volume": undefined }))
    ).toThrow("expected uint field: total-volume");
  });
});

describe("buildProtocolMetrics", () => {
  it("aggregates both vaults when every source is available", () => {
    expect(
      buildProtocolMetrics({
        stxVault,
        sbtcVault,
        prices: { stxUsd: 2, btcUsd: 60_000 },
        updatedAt: 123,
      })
    ).toEqual({
      plansCreated: 3,
      swapsExecuted: 9,
      avgSwapsPerPlan: 3,
      volumeUsd: 60_020,
      sources: { stxVault: "ok", sbtcVault: "ok", prices: "ok" },
      updatedAt: 123,
    });
  });

  it("does not present partial vault totals as authoritative zeroes", () => {
    const result = buildProtocolMetrics({
      stxVault,
      sbtcVault: null,
      prices: { stxUsd: 2, btcUsd: 60_000 },
    });

    expect(result.plansCreated).toBeNull();
    expect(result.swapsExecuted).toBeNull();
    expect(result.avgSwapsPerPlan).toBeNull();
    expect(result.volumeUsd).toBeNull();
    expect(result.sources.sbtcVault).toBe("unavailable");
  });

  it("keeps count metrics but withholds USD volume when prices are unavailable", () => {
    const result = buildProtocolMetrics({
      stxVault,
      sbtcVault,
      prices: { stxUsd: null, btcUsd: null },
    });

    expect(result.plansCreated).toBe(3);
    expect(result.swapsExecuted).toBe(9);
    expect(result.volumeUsd).toBeNull();
    expect(result.sources.prices).toBe("unavailable");
  });

  it("reports partial price availability", () => {
    const result = buildProtocolMetrics({
      stxVault,
      sbtcVault,
      prices: { stxUsd: 2, btcUsd: null },
    });

    expect(result.volumeUsd).toBeNull();
    expect(result.sources.prices).toBe("partial");
  });

  it("preserves genuine zero protocol usage", () => {
    const zero = { plans: 0, volume: 0, executed: 0 };
    const result = buildProtocolMetrics({
      stxVault: zero,
      sbtcVault: zero,
      prices: { stxUsd: 2, btcUsd: 60_000 },
    });

    expect(result.plansCreated).toBe(0);
    expect(result.swapsExecuted).toBe(0);
    expect(result.avgSwapsPerPlan).toBe(0);
    expect(result.volumeUsd).toBe(0);
  });
});
