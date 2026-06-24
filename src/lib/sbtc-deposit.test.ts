// src/lib/sbtc-deposit.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { getSbtcNetwork, validateDepositAmount, SBTC_DUST_SATS, DEFAULT_MAX_SIGNER_FEE_SATS, buildDepositParams } from "./sbtc-deposit";

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

describe("validateDepositAmount", () => {
  const min = SBTC_DUST_SATS + DEFAULT_MAX_SIGNER_FEE_SATS;

  it("rejects amounts below dust + signer fee", () => {
    expect(validateDepositAmount(min - 1)).toEqual({ ok: false, reason: "below_min", minSats: min });
  });

  it("accepts amounts at the minimum", () => {
    expect(validateDepositAmount(min)).toEqual({ ok: true, minSats: min });
  });

  it("rejects non-integer sats", () => {
    expect(validateDepositAmount(min + 0.5).reason).toBe("non_integer");
  });

  it("rejects zero / negative", () => {
    expect(validateDepositAmount(0).reason).toBe("not_positive");
  });

  it("uses a custom signer fee in the minimum", () => {
    expect(validateDepositAmount(SBTC_DUST_SATS + 5_000, 5_000).ok).toBe(true);
  });
});

describe("buildDepositParams", () => {
  it("builds a deposit address using the signers key", async () => {
    const fakeClient = { fetchSignersPublicKey: async () => "02".padEnd(66, "a") };
    const out = await buildDepositParams({
      stacksAddress: "SP3FGQ8Z7JY9BWYZ5WM53E0M9NK7WHJF0691NZ159",
      reclaimPublicKey: "03".padEnd(66, "b"),
      client: fakeClient,
    });
    expect(out.address).toMatch(/^(bc1|tb1)/);
    expect(typeof out.depositScript).toBe("string");
    expect(typeof out.reclaimScript).toBe("string");
  });

  it("throws on a malformed reclaim public key length", async () => {
    const fakeClient = { fetchSignersPublicKey: async () => "02".padEnd(66, "a") };
    await expect(buildDepositParams({
      stacksAddress: "SP3FGQ8Z7JY9BWYZ5WM53E0M9NK7WHJF0691NZ159",
      reclaimPublicKey: "abc", // 3 chars — invalid
      client: fakeClient,
    })).rejects.toThrow(/Unexpected pubkey length/);
  });
});
