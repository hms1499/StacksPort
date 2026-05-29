import { describe, it, expect } from "vitest";
import {
  TOKEN_REGISTRY,
  STACKS_GECKO_IDS,
  CONTRACT_TO_GECKO_ID,
  GECKO_ID_TO_DECIMALS,
  GECKO_ID_TO_SWAP_ID,
  isStacksGeckoId,
} from "./token-registry";

describe("token-registry invariants", () => {
  it("has no duplicate gecko ids", () => {
    const ids = TOKEN_REGISTRY.map((t) => t.geckoId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate symbols", () => {
    const syms = TOKEN_REGISTRY.map((t) => t.symbol);
    expect(new Set(syms).size).toBe(syms.length);
  });

  it("any entry with a contractId also declares decimals", () => {
    for (const t of TOKEN_REGISTRY) {
      if (t.contractId) expect(t.decimals).toBeTypeOf("number");
    }
  });
});

describe("derived maps preserve legacy behavior", () => {
  it("Stacks bubble set matches the legacy STACKS_TOKEN_IDS membership", () => {
    expect(new Set(STACKS_GECKO_IDS)).toEqual(
      new Set([
        "blockstack",
        "sbtc-2",
        "alexgo",
        "velar",
        "hermetica-usdh",
        "welsh-corgi-coin",
      ])
    );
  });

  it("isStacksGeckoId tracks the Stacks set", () => {
    expect(isStacksGeckoId("welsh-corgi-coin")).toBe(true);
    expect(isStacksGeckoId("bitcoin")).toBe(false);
  });

  it("holdings contract map matches the legacy CONTRACT_TO_COINGECKO", () => {
    expect(CONTRACT_TO_GECKO_ID).toEqual({
      "sm3vdxk3wzzsa84xxfkafaf15nnzx32ctsg82jfq4.sbtc-token": "sbtc-2",
    });
    expect(GECKO_ID_TO_DECIMALS["sbtc-2"]).toBe(8);
  });

  it("swap-id map matches the legacy COINGECKO_TO_SWAP_ID", () => {
    expect(GECKO_ID_TO_SWAP_ID).toEqual({ blockstack: "stx", "sbtc-2": "sbtc" });
  });
});

describe("alert tokens use verified (non-dead) gecko ids", () => {
  const alertIds = TOKEN_REGISTRY.filter((t) => t.alert).map((t) => t.geckoId);

  it("uses the live WELSH and stSTX ids, not the dead ones", () => {
    expect(alertIds).toContain("welsh-corgi-coin");
    expect(alertIds).toContain("stacking-dao");
    expect(alertIds).not.toContain("welshcorgicoin");
    expect(alertIds).not.toContain("staked-stx");
  });
});
