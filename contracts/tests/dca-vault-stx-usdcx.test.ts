import { describe, it, expect } from "vitest";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { Cl, ClarityValue } from "@stacks/transactions";

const manifest = "./Clarinet.toml.test";
const simnet = await initSimnet(manifest);
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;

// Use deployer as the primary user since it's the only registered simnet account.
// For multi-user tests, we'll use raw STX addresses as secondary users.
const wallet1 = deployer; // primary user
const wallet2 = "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5"; // secondary user (for auth tests)

const VAULT = "test-dca-vault-stx-usdcx";
const MOCK_USDCX = "mock-usdcx";
const ROUTER = "mock-stx-usdcx-router";

// Helpers
function usdcxBalance(who: string) {
  return simnet.callReadOnlyFn(MOCK_USDCX, "get-balance", [Cl.principal(who)], deployer).result;
}

function createPlan(sender: string, amount = 1000000, interval = 144, deposit = 2000000) {
  return simnet.callPublicFn(
    VAULT, "create-plan",
    [Cl.principal(`${deployer}.${MOCK_USDCX}`), Cl.uint(amount), Cl.uint(interval), Cl.uint(deposit)],
    sender
  );
}

function executeDca(planId: number, sender = deployer) {
  return simnet.callPublicFn(
    VAULT, "execute-dca",
    [Cl.uint(planId), Cl.contractPrincipal(deployer, ROUTER), Cl.uint(0)],
    sender
  );
}

function extractPlanId(res: { result: ClarityValue }): number {
  // result is ok(uint) -> { type: "ok", value: { type: "uint", value: bigint } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Number((res.result as any).value.value);
}

function vaultAddr() {
  return `${deployer}.${VAULT}`;
}

// NOTE: Simnet state persists across all tests. Tests must not rely on absolute IDs.

describe("DCA Vault STX->USDCx", () => {

  // ---- CREATE PLAN ----
  describe("create-plan", () => {
    it("creates a plan successfully with valid params", () => {
      const res = createPlan(wallet1);
      expect(res.result.type).toBe("ok");

      const planId = extractPlanId(res);
      const plan = simnet.callReadOnlyFn(VAULT, "get-plan", [Cl.uint(planId)], deployer);
      expect(plan.result.type).toBe("some");
    });

    it("transfers STX from user to vault on create", () => {
      const stxBefore = simnet.getAssetsMap().get("STX")?.get(vaultAddr()) ?? BigInt(0);
      createPlan(wallet1, 1000000, 144, 2000000);
      const stxAfter = simnet.getAssetsMap().get("STX")?.get(vaultAddr()) ?? BigInt(0);
      expect(stxAfter).toBeGreaterThan(stxBefore);
    });

    it("rejects amount below MSA (1 STX = 1000000 uSTX) - E105", () => {
      const res = createPlan(wallet1, 999999, 144, 2000000);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(105)));
    });

    it("rejects interval below BPD (144 blocks) - E106", () => {
      const res = createPlan(wallet1, 1000000, 143, 2000000);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(106)));
    });

    it("rejects deposit below MID (2 STX = 2000000 uSTX) - E109", () => {
      const res = createPlan(wallet1, 1000000, 144, 1999999);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(109)));
    });

    it("rejects deposit less than amount-per-interval - E103", () => {
      const res = createPlan(wallet1, 5000000, 144, 2000000);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(103)));
    });

    // Note: E107 max-plans test is not included because the simnet only registers
    // the deployer account (no wallet2 STX balance), and stx-transfer? requires
    // real STX. The MPPU guard uses identical logic to dca-vault-v2 (which is
    // already covered by that contract's test suite).
  });

  // ---- DEPOSIT ----
  describe("deposit", () => {
    it("deposits additional STX to existing plan", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callPublicFn(VAULT, "deposit", [Cl.uint(planId), Cl.uint(1000000)], wallet1);
      expect(res.result).toStrictEqual(Cl.ok(Cl.bool(true)));
    });

    it("rejects deposit to non-existent plan - E101", () => {
      const res = simnet.callPublicFn(VAULT, "deposit", [Cl.uint(99999), Cl.uint(1000000)], wallet1);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(101)));
    });

    it("rejects deposit from non-owner - E100", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callPublicFn(VAULT, "deposit", [Cl.uint(planId), Cl.uint(1000000)], wallet2);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(100)));
    });

    it("rejects deposit below MSA - E105", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callPublicFn(VAULT, "deposit", [Cl.uint(planId), Cl.uint(999999)], wallet1);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(105)));
    });
  });

  // ---- EXECUTE DCA ----
  describe("execute-dca", () => {
    it("executes DCA and returns correct fee breakdown", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 5000000));

      const res = executeDca(planId);

      // protocol fee = 1000000 * 30 / 10000 = 3000, net = 997000
      expect(res.result).toStrictEqual(
        Cl.ok(Cl.tuple({
          "net-swapped": Cl.uint(997000),
          "protocol-fee": Cl.uint(3000),
          "swaps-done": Cl.uint(1),
          "bal-remaining": Cl.uint(4000000),
        }))
      );
    });

    it("sends mock-usdcx to plan owner via mock router", () => {
      const usdcxBefore = usdcxBalance(wallet1);
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 5000000));

      executeDca(planId);

      const usdcxAfter = usdcxBalance(wallet1);
      expect(usdcxAfter).not.toStrictEqual(usdcxBefore);
    });

    it("rejects execution on inactive (paused) plan - E102", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 5000000));

      simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet1);
      const res = executeDca(planId);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(102)));
    });

    it("rejects execution before interval elapsed - E104", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 5000000));

      executeDca(planId); // first succeeds
      const res = executeDca(planId); // second fails
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(104)));
    });

    it("succeeds after interval has passed", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 5000000));

      executeDca(planId);
      simnet.mineEmptyBlocks(144);

      const res = executeDca(planId);
      expect(res.result).toStrictEqual(
        Cl.ok(Cl.tuple({
          "net-swapped": Cl.uint(997000),
          "protocol-fee": Cl.uint(3000),
          "swaps-done": Cl.uint(2),
          "bal-remaining": Cl.uint(3000000),
        }))
      );
    });

    it("auto-deactivates plan when remaining balance < swap amount", () => {
      // amount = deposit = MID so one execution drains balance to 0 → auto-deactivate
      const planId = extractPlanId(createPlan(wallet1, 2000000, 144, 2000000));

      executeDca(planId);

      const canExec = simnet.callReadOnlyFn(VAULT, "can-execute", [Cl.uint(planId)], deployer);
      expect(canExec.result).toStrictEqual(Cl.bool(false));
    });

    it("rejects non-existent plan - E101", () => {
      const res = executeDca(99999);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(101)));
    });

    it("updates global stats after execution", () => {
      const teBefore = simnet.getDataVar(VAULT, "tse");

      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 5000000));
      executeDca(planId);

      const teAfter = simnet.getDataVar(VAULT, "tse");
      expect(teAfter).not.toStrictEqual(teBefore);
    });
  });

  // ---- PAUSE / RESUME ----
  describe("pause-plan", () => {
    it("pauses an active plan", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.ok(Cl.bool(true)));

      const canExec = simnet.callReadOnlyFn(VAULT, "can-execute", [Cl.uint(planId)], deployer);
      expect(canExec.result).toStrictEqual(Cl.bool(false));
    });

    it("rejects pause from non-owner - E100", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet2);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(100)));
    });

    it("rejects pause on already paused plan - E102", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));
      simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet1);

      const res = simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(102)));
    });
  });

  describe("resume-plan", () => {
    it("resumes a paused plan", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));
      simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet1);

      const res = simnet.callPublicFn(VAULT, "resume-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.ok(Cl.bool(true)));
    });

    it("rejects resume on active plan - E102", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callPublicFn(VAULT, "resume-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(102)));
    });

    it("rejects resume when balance < amount - E103", () => {
      // amount = deposit = MID so one execution drains to 0 and auto-deactivates
      const planId = extractPlanId(createPlan(wallet1, 2000000, 144, 2000000));

      executeDca(planId); // drains balance to 0, auto-deactivates

      const res = simnet.callPublicFn(VAULT, "resume-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(103)));
    });
  });

  // ---- CANCEL ----
  describe("cancel-plan", () => {
    it("cancels plan and refunds remaining balance", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callPublicFn(VAULT, "cancel-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.ok(Cl.uint(2000000)));
    });

    it("rejects cancel from non-owner - E100", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callPublicFn(VAULT, "cancel-plan", [Cl.uint(planId)], wallet2);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(100)));
    });

    it("handles cancel with zero balance (already drained)", () => {
      // amount = deposit = MID so one execution drains to 0 and auto-deactivates
      const planId = extractPlanId(createPlan(wallet1, 2000000, 144, 2000000));

      executeDca(planId); // drains to 0

      const res = simnet.callPublicFn(VAULT, "cancel-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.ok(Cl.uint(0)));
    });
  });

  // ---- READ-ONLY FUNCTIONS ----
  describe("read-only functions", () => {
    it("remaining-swaps returns correct count", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callReadOnlyFn(VAULT, "remaining-swaps", [Cl.uint(planId)], deployer);
      expect(res.result).toStrictEqual(Cl.ok(Cl.uint(2))); // 2000000 / 1000000 = 2
    });

    it("can-execute returns true for executable plan", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callReadOnlyFn(VAULT, "can-execute", [Cl.uint(planId)], deployer);
      expect(res.result).toStrictEqual(Cl.bool(true));
    });

    it("can-execute returns false for non-existent plan", () => {
      const res = simnet.callReadOnlyFn(VAULT, "can-execute", [Cl.uint(99999)], deployer);
      expect(res.result).toStrictEqual(Cl.bool(false));
    });

    it("next-execution-block returns ok for new plan", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callReadOnlyFn(VAULT, "next-execution-block", [Cl.uint(planId)], deployer);
      expect(res.result.type).toBe("ok");
    });

    it("get-user-plans returns list of plan IDs", () => {
      const planId = extractPlanId(createPlan(wallet1, 1000000, 144, 2000000));

      const res = simnet.callReadOnlyFn(VAULT, "get-user-plans", [Cl.principal(wallet1)], deployer);
      // Result is a list type containing uints
      expect(res.result.type).toBe("list");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (res.result as any).value;
      // The plan we just created should be in the list
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = list.map((v: any) => Number(v.value));
      expect(ids).toContain(planId);
    });
  });
});
