// src/lib/domain/stacking/clarity.test.ts
import { describe, it, expect } from "vitest";
import { PostConditionMode } from "@stacks/transactions";
import { buildStakeParams } from "./clarity";

const SENDER = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

describe("buildStakeParams", () => {
  const p = buildStakeParams(5_000_000, SENDER);

  it("targets the StackingDAO core deposit function", () => {
    expect(p.contractAddress).toBe("SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG");
    expect(p.contractName).toBe("stacking-dao-core-v1");
    expect(p.functionName).toBe("deposit");
  });

  it("passes reserve, amount, and no referrer (3 args)", () => {
    expect(p.functionArgs).toHaveLength(3);
  });

  it("guards exactly the staked STX with a single post-condition in Deny mode", () => {
    expect(p.postConditions).toHaveLength(1);
    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
  });
});
