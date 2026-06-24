// src/lib/sbtc-deposit.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { getSbtcNetwork } from "./sbtc-deposit";

describe("getSbtcNetwork", () => {
  const orig = process.env.SBTC_NETWORK;
  afterEach(() => { process.env.SBTC_NETWORK = orig; });

  it("defaults to mainnet", () => {
    delete process.env.SBTC_NETWORK;
    expect(getSbtcNetwork()).toBe("mainnet");
  });

  it("honors testnet", () => {
    process.env.SBTC_NETWORK = "testnet";
    expect(getSbtcNetwork()).toBe("testnet");
  });

  it("ignores garbage and falls back to mainnet", () => {
    process.env.SBTC_NETWORK = "wat";
    expect(getSbtcNetwork()).toBe("mainnet");
  });
});
