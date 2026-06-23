import { describe, expect, it } from "vitest";
import { cvToString, PostConditionMode } from "@stacks/transactions";
import { buildSupplyParams, buildWithdrawParams, type CollateralReserve } from "./clarity";

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

const SBTC_RESERVE: CollateralReserve = {
  asset: { address: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", name: "sbtc-token" },
  lpToken: { address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N", name: "zsbtc-v2-0" },
  oracle: { address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N", name: "stx-btc-oracle-v1-4" },
};

describe("buildWithdrawParams", () => {
  it("orders args: lp, pool-reserve, asset, oracle, amount, owner, assets[]", () => {
    const OWNER = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N";
    const p = buildWithdrawParams(100_000, OWNER, [SBTC_RESERVE]);
    expect(p.functionName).toBe("withdraw");
    expect(cvToString(p.functionArgs[0])).toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0");
    expect(cvToString(p.functionArgs[1])).toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve");
    expect(cvToString(p.functionArgs[2])).toBe("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token");
    expect(cvToString(p.functionArgs[3])).toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4");
    expect(cvToString(p.functionArgs[4])).toBe("u100000");
    expect(cvToString(p.functionArgs[5])).toBe(OWNER);
    // 7th arg is the (list 100 {...}) of collateral reserves
    expect(cvToString(p.functionArgs[6])).toContain("sbtc-token");
  });

  it("uses Allow mode (incoming sBTC amount varies with accrued interest)", () => {
    const p = buildWithdrawParams(100_000, "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N", [SBTC_RESERVE]);
    expect(p.postConditionMode).toBe(PostConditionMode.Allow);
  });
});
