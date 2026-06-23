import { describe, expect, it } from "vitest";
import { cvToString, PostConditionMode } from "@stacks/transactions";
import { buildSupplyParams } from "./clarity";

const OWNER = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N";

describe("buildSupplyParams", () => {
  it("targets borrow-helper-v2-0.supply", () => {
    const p = buildSupplyParams(100_000, OWNER);
    expect(p.contractAddress).toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N");
    expect(p.contractName).toBe("borrow-helper-v2-0");
    expect(p.functionName).toBe("supply");
  });

  it("orders args: lp, pool-reserve, asset, amount, owner, referral=none", () => {
    const p = buildSupplyParams(100_000, OWNER);
    expect(p.functionArgs.map((a) => cvToString(a))).toEqual([
      "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0",
      "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve",
      "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
      "u100000",
      OWNER,
      "none",
    ]);
  });

  it("pins a Deny-mode PC sending exactly amount sbtc-token", () => {
    const p = buildSupplyParams(100_000, OWNER);
    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
    expect(p.postConditions).toHaveLength(1);
  });
});
