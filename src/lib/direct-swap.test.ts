import { describe, it, expect } from "vitest";
import { PostConditionMode } from "@stacks/transactions";
import { buildSwapParams, toRawAmount, applySlippageFloor } from "./direct-swap";

describe("toRawAmount", () => {
  it("converts whole and fractional human amounts to raw integer units", () => {
    expect(toRawAmount("1", 6)).toBe(1000000n);
    expect(toRawAmount("0.001", 8)).toBe(100000n);
    expect(toRawAmount(0.1, 8)).toBe(10000000n);
  });

  it("truncates fraction beyond token decimals (no rounding up)", () => {
    expect(toRawAmount("1.123456789", 6)).toBe(1123456n);
  });

  it("keeps full precision for large 8-decimal amounts (float would lose this)", () => {
    expect(toRawAmount("99999999.12345678", 8)).toBe(9999999912345678n);
  });

  it("handles empty / zero input as 0n", () => {
    expect(toRawAmount("", 6)).toBe(0n);
    expect(toRawAmount("0", 8)).toBe(0n);
  });
});

describe("applySlippageFloor", () => {
  it("reduces the raw amount by the slippage percent, flooring", () => {
    expect(applySlippageFloor(1000000n, 0.5)).toBe(995000n);
    expect(applySlippageFloor(1000000n, 1)).toBe(990000n);
    expect(applySlippageFloor(1000003n, 0.1)).toBe(999002n);
  });
});

const SENDER = "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";
const SBTC_ASSET = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token";

describe("buildSwapParams post-conditions", () => {
  it("STX → sBTC: Deny mode + exact uSTX outgoing post-condition from sender", () => {
    const p = buildSwapParams("stx", "sbtc", 1, 334, SENDER);

    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
    expect(p.postConditions).toHaveLength(1);
    expect(p.postConditions[0]).toMatchObject({
      type: "stx-postcondition",
      address: SENDER,
      condition: "eq",
      amount: "1000000", // 1 STX, 6 decimals
    });
  });

  it("sBTC → STX: Deny mode + exact sBTC FT outgoing post-condition from sender", () => {
    const p = buildSwapParams("sbtc", "stx", 0.001, 1000000, SENDER);

    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
    expect(p.postConditions).toHaveLength(1);
    expect(p.postConditions[0]).toMatchObject({
      type: "ft-postcondition",
      address: SENDER,
      condition: "eq",
      amount: "100000", // 0.001 sBTC, 8 decimals
      asset: SBTC_ASSET,
    });
  });

  it("sBTC → USDCx (multi-hop router): Deny mode + exact sBTC FT outgoing post-condition from sender", () => {
    const p = buildSwapParams("sbtc", "usdcx", 0.01, 5000000, SENDER);

    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
    expect(p.postConditions).toHaveLength(1);
    expect(p.postConditions[0]).toMatchObject({
      type: "ft-postcondition",
      address: SENDER,
      condition: "eq",
      amount: "1000000", // 0.01 sBTC, 8 decimals
      asset: SBTC_ASSET,
    });
  });
});
