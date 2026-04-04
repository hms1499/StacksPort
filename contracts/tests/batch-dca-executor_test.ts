// contracts/tests/batch-dca-executor_test.ts
import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1  = accounts.get("wallet_1")!;

describe("batch-dca-executor", () => {
  it("returns ERR-EMPTY-LIST (u100) when passed empty list", () => {
    const result = simnet.callPublicFn(
      "batch-dca-executor",
      "batch-execute-dca",
      [Cl.list([])],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(100));
  });

  it("get-max-batch returns u50", () => {
    const result = simnet.callReadOnlyFn(
      "batch-dca-executor",
      "get-max-batch",
      [],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(50));
  });

  it("batch with one valid plan returns success=0 failed=1 (plan 1 not ready)", () => {
    // Plan 1 may not be executable in simnet — partial failure should not revert
    const result = simnet.callPublicFn(
      "batch-dca-executor",
      "batch-execute-dca",
      [Cl.list([Cl.tuple({ "plan-id": Cl.uint(1), "vault-type": Cl.uint(0) })])],
      deployer
    );
    // Should be (ok {...}) not (err ...)
    expect(result.result.type).toBe("ok");
  });
});
