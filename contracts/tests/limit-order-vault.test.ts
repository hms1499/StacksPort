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

function executeOrder(id: number, minOut = 0, sender = deployer) {
  return simnet.callPublicFn(
    VAULT, "execute-order",
    [Cl.uint(id), Cl.contractPrincipal(deployer, ROUTER), Cl.uint(minOut)],
    sender
  );
}
function sbtcBalance(who: string) {
  return simnet.callReadOnlyFn(MOCK_SBTC, "get-balance", [Cl.principal(who)], deployer).result;
}

describe("limit-order-vault: execute-order", () => {
  it("fills an open order, sends sBTC to owner, decrements open-count", () => {
    const before = sbtcBalance(wallet1);
    const id = extractId(createOrder(wallet1));
    const openBefore = openCount(wallet1);
    const res = executeOrder(id, 0);
    expect(res.result.type).toBe("ok");
    const after = sbtcBalance(wallet1);
    expect(Cl.prettyPrint(after)).not.toBe(Cl.prettyPrint(before)); // owner got sBTC
    expect(Cl.prettyPrint(openCount(wallet1))).not.toBe(Cl.prettyPrint(openBefore)); // decremented
    // order is now filled (status u1)
    const order = getOrder(id);
    expect(order.type).toBe("some");
  });

  it("reverts when min-amount-out is not met", () => {
    const id = extractId(createOrder(wallet1));
    // mock mints amount-in (= net) 1:1; ask for far more than deposit
    const res = executeOrder(id, MID * 10);
    expect(res.result).toStrictEqual(Cl.error(Cl.uint(999)));
  });

  it("cannot execute an already-filled order", () => {
    const id = extractId(createOrder(wallet1));
    expect(executeOrder(id, 0).result.type).toBe("ok");
    const res = executeOrder(id, 0);
    expect(res.result).toStrictEqual(Cl.error(Cl.uint(102)));
  });

  it("is permissionless — a non-owner can execute", () => {
    const id = extractId(createOrder(wallet1));
    const res = executeOrder(id, 0, wallet2);
    expect(res.result.type).toBe("ok");
  });
});

function cancelOrder(id: number, sender = deployer) {
  return simnet.callPublicFn(VAULT, "cancel-order", [Cl.uint(id)], sender);
}

describe("limit-order-vault: cancel-order", () => {
  it("refunds and decrements open-count", () => {
    const id = extractId(createOrder(wallet1)); // deposit = MID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = Number((openCount(wallet1) as any).value);
    const res = cancelOrder(id);
    expect(res.result).toStrictEqual(Cl.ok(Cl.uint(MID)));
    expect(openCount(wallet1)).toStrictEqual(Cl.uint(before - 1));
  });

  it("only the owner can cancel", () => {
    const id = extractId(createOrder(wallet1));
    const res = cancelOrder(id, wallet2);
    expect(res.result).toStrictEqual(Cl.error(Cl.uint(100)));
  });

  it("cannot cancel a filled order", () => {
    const id = extractId(createOrder(wallet1));
    executeOrder(id, 0);
    const res = cancelOrder(id);
    expect(res.result).toStrictEqual(Cl.error(Cl.uint(102)));
  });
});

describe("limit-order-vault: open-order cap", () => {
  it("rejects an 11th concurrently-open order then allows one after a fill frees a slot", () => {
    // fresh principal — open-cnt starts at 0; fund with enough STX for >=11 orders
    const u = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
    simnet.transferSTX(30_000_000, u, deployer); // 30 STX — enough for 11×2 STX orders
    // open 10
    const ids: number[] = [];
    for (let i = 0; i < 10; i++) ids.push(extractId(createOrder(u)));
    // 11th rejected
    expect(createOrder(u).result).toStrictEqual(Cl.error(Cl.uint(107)));
    // fill one to free a slot
    executeOrder(ids[0], 0);
    // now one more is allowed
    expect(createOrder(u).result.type).toBe("ok");
  });
});

describe("limit-order-vault: E108 order-history-full", () => {
  it("returns E108 when a principal's lifetime order list hits 200", () => {
    // Fresh principal — fund with enough STX for 200 create+cancel cycles (each needs 2 STX)
    // plus a final create attempt. 201 × 2 STX = 402 STX → 402_000_000 uSTX.
    const u = "ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ";
    simnet.transferSTX(410_000_000, u, deployer);

    // Create + immediately cancel 200 orders so open-cnt never exceeds MPPU=10
    // but lifetime uids list fills to 200.
    for (let i = 0; i < 200; i++) {
      const id = extractId(createOrder(u));
      cancelOrder(id, u);
    }

    // 201st create must return E108
    expect(createOrder(u).result).toStrictEqual(Cl.error(Cl.uint(108)));
  });
});
