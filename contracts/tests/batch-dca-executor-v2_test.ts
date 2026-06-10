// contracts/tests/batch-dca-executor-v2.test.ts
import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;

describe("batch-dca-executor-v2", () => {
  it("returns ERR-EMPTY-LIST (u100) when passed empty list", () => {
    const result = simnet.callPublicFn(
      "batch-dca-executor-v2",
      "batch-execute-dca",
      [Cl.list([])],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(100));
  });

  it("get-max-batch returns u50", () => {
    const result = simnet.callReadOnlyFn(
      "batch-dca-executor-v2",
      "get-max-batch",
      [],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(50));
  });

  it("batch with one vault-type u2 plan returns ok (plan not ready → counted as failed)", () => {
    // Plan 99 doesn't exist in the dca-vault-stx-usdcx simnet state.
    // The fold should NOT revert — it should return (ok { success: u0, failed: u1 }).
    const result = simnet.callPublicFn(
      "batch-dca-executor-v2",
      "batch-execute-dca",
      [Cl.list([Cl.tuple({ "plan-id": Cl.uint(99), "vault-type": Cl.uint(2) })])],
      deployer
    );
    // Must be (ok ...) not (err ...)
    expect(result.result.type).toBe("ok");
  });

  it("vault-type u2 failing plan does not revert the batch — failed counter increments", () => {
    // Two vault-type u2 entries, neither plan exists in simnet.
    // Expected: (ok { success: u0, failed: u2 })
    const result = simnet.callPublicFn(
      "batch-dca-executor-v2",
      "batch-execute-dca",
      [
        Cl.list([
          Cl.tuple({ "plan-id": Cl.uint(1), "vault-type": Cl.uint(2) }),
          Cl.tuple({ "plan-id": Cl.uint(2), "vault-type": Cl.uint(2) }),
        ]),
      ],
      deployer
    );
    expect(result.result.type).toBe("ok");
    // Verify the failed count is 2 (both plans non-existent → both counted as failed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inner = (result.result as any).value;
    expect(inner.data.failed).toStrictEqual(Cl.uint(2));
    expect(inner.data.success).toStrictEqual(Cl.uint(0));
  });

  it("mixed vault-types (u0, u1, u2) all failing returns ok with correct failed count", () => {
    const result = simnet.callPublicFn(
      "batch-dca-executor-v2",
      "batch-execute-dca",
      [
        Cl.list([
          Cl.tuple({ "plan-id": Cl.uint(1), "vault-type": Cl.uint(0) }),
          Cl.tuple({ "plan-id": Cl.uint(1), "vault-type": Cl.uint(1) }),
          Cl.tuple({ "plan-id": Cl.uint(1), "vault-type": Cl.uint(2) }),
        ]),
      ],
      deployer
    );
    expect(result.result.type).toBe("ok");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inner = (result.result as any).value;
    expect(inner.data.failed).toStrictEqual(Cl.uint(3));
    expect(inner.data.success).toStrictEqual(Cl.uint(0));
  });
});
