import { describe, it, expect } from "vitest";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { Cl, ClarityValue } from "@stacks/transactions";

const manifest = "./Clarinet.toml.test";
const simnet = await initSimnet(manifest);
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = deployer;
const wallet2 = "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5";

const VAULT = "limit-order-vault";
const MOCK_SBTC = "mock-sbtc";
const ROUTER = "mock-stx-sbtc-router";
const MID = 2_000_000;
const TARGET_USD = 60_000_000_000; // $60,000 * 1e6

function createOrder(sender: string, deposit = MID, targetUsd = TARGET_USD) {
  return simnet.callPublicFn(
    VAULT, "create-order",
    [Cl.principal(`${deployer}.${MOCK_SBTC}`), Cl.uint(deposit), Cl.uint(targetUsd)],
    sender
  );
}
function getOrder(id: number) {
  return simnet.callReadOnlyFn(VAULT, "get-order", [Cl.uint(id)], deployer).result;
}
function openCount(who: string) {
  return simnet.callReadOnlyFn(VAULT, "get-open-order-count", [Cl.principal(who)], deployer).result;
}
function extractId(res: { result: ClarityValue }): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Number((res.result as any).value.value);
}

// NOTE: simnet state persists across tests — never assert absolute ids.

describe("limit-order-vault: create-order", () => {
  it("creates an order with valid params and bumps open-count", () => {
    const before = openCount(wallet1);
    const res = createOrder(wallet1);
    expect(res.result.type).toBe("ok");
    const id = extractId(res);
    const order = getOrder(id);
    expect(order.type).toBe("some");
    // status open = u0
    expect(Cl.prettyPrint(openCount(wallet1))).not.toBe(Cl.prettyPrint(before));
  });

  it("rejects a deposit below MID", () => {
    const res = createOrder(wallet1, MID - 1);
    expect(res.result).toStrictEqual(Cl.error(Cl.uint(109)));
  });

  it("rejects target-usd of zero", () => {
    const res = createOrder(wallet1, MID, 0);
    expect(res.result).toStrictEqual(Cl.error(Cl.uint(105)));
  });
});
