import { describe, it, expect } from "vitest";
import { PostConditionMode } from "@stacks/transactions";
import { buildSwapParams } from "./direct-swap";

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
