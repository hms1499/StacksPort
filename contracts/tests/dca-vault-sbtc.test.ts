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

const VAULT = "test-dca-vault-sbtc";
const MOCK_SBTC = "mock-sbtc";
const MOCK_USDCX = "mock-usdcx";
const ROUTER = "mock-sbtc-swap-router";

// Helpers
function mintSbtc(amount: number, recipient: string) {
  return simnet.callPublicFn(MOCK_SBTC, "mint", [Cl.uint(amount), Cl.principal(recipient)], deployer);
}

function sbtcBalance(who: string) {
  return simnet.callReadOnlyFn(MOCK_SBTC, "get-balance", [Cl.principal(who)], deployer).result;
}

function usdcxBalance(who: string) {
  return simnet.callReadOnlyFn(MOCK_USDCX, "get-balance", [Cl.principal(who)], deployer).result;
}

function createPlan(sender: string, amount = 100, interval = 144, deposit = 1000) {
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
  return Number((res.result as any).value.value);
}

function vaultAddr() {
  return `${deployer}.${VAULT}`;
}

// NOTE: Simnet state persists across all tests. Tests must not rely on absolute IDs.

describe("DCA Vault sBTC", () => {

  // ---- CREATE PLAN ----
  describe("create-plan", () => {
    it("creates a plan successfully with valid params", () => {
      mintSbtc(10000, wallet1);
      const res = createPlan(wallet1);
      expect(res.result.type).toBe("ok");

      const planId = extractPlanId(res);
      const plan = simnet.callReadOnlyFn(VAULT, "get-plan", [Cl.uint(planId)], deployer);
      expect(plan.result.type).toBe("some");
    });

    it("transfers sBTC from user to vault on create", () => {
      mintSbtc(10000, wallet1);
      const vaultBalBefore = sbtcBalance(vaultAddr());
      createPlan(wallet1, 100, 144, 500);
      const vaultBalAfter = sbtcBalance(vaultAddr());
      expect(vaultBalAfter).not.toStrictEqual(vaultBalBefore);
    });

    it("rejects amount below MSA (20 satoshis) - E105", () => {
      mintSbtc(10000, wallet1);
      const res = createPlan(wallet1, 19, 144, 40);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(105)));
    });

    it("rejects interval below BPD (144 blocks) - E106", () => {
      mintSbtc(10000, wallet1);
      const res = createPlan(wallet1, 20, 143, 40);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(106)));
    });

    it("rejects deposit below MID (40 satoshis) - E109", () => {
      mintSbtc(10000, wallet1);
      const res = createPlan(wallet1, 20, 144, 39);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(109)));
    });

    it("rejects deposit less than amount-per-interval - E103", () => {
      mintSbtc(10000, wallet1);
      const res = createPlan(wallet1, 100, 144, 50);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(103)));
    });

    it("rejects when user has max plans (100) - E107", () => {
      // Use wallet2 so it starts with 0 plans. Test contract has MPPU=100 for testing.
      mintSbtc(10000000, wallet2);
      for (let i = 0; i < 100; i++) {
        const r = createPlan(wallet2, 20, 144, 40);
        expect(r.result.type).toBe("ok");
      }
      const res = createPlan(wallet2, 20, 144, 40);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(107)));
    });
  });

  // ---- DEPOSIT ----
  describe("deposit", () => {
    it("deposits additional sBTC to existing plan", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callPublicFn(VAULT, "deposit", [Cl.uint(planId), Cl.uint(200)], wallet1);
      expect(res.result).toStrictEqual(Cl.ok(Cl.bool(true)));
    });

    it("rejects deposit to non-existent plan - E101", () => {
      const res = simnet.callPublicFn(VAULT, "deposit", [Cl.uint(99999), Cl.uint(100)], wallet1);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(101)));
    });

    it("rejects deposit from non-owner - E100", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      mintSbtc(10000, wallet2);
      const res = simnet.callPublicFn(VAULT, "deposit", [Cl.uint(planId), Cl.uint(100)], wallet2);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(100)));
    });

    it("rejects deposit below MSA - E105", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callPublicFn(VAULT, "deposit", [Cl.uint(planId), Cl.uint(19)], wallet1);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(105)));
    });
  });

  // ---- EXECUTE DCA ----
  describe("execute-dca", () => {
    it("executes DCA and returns correct fee breakdown", () => {
      mintSbtc(100000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 10000, 144, 50000));

      const res = executeDca(planId);

      // protocol fee = 10000 * 30 / 10000 = 30, net = 9970
      expect(res.result).toStrictEqual(
        Cl.ok(Cl.tuple({
          "net-swapped": Cl.uint(9970),
          "protocol-fee": Cl.uint(30),
          "swaps-done": Cl.uint(1),
          "bal-remaining": Cl.uint(40000),
        }))
      );
    });

    it("sends USDCx to plan owner via mock router", () => {
      mintSbtc(100000, wallet1);
      const usdcxBefore = usdcxBalance(wallet1);
      const planId = extractPlanId(createPlan(wallet1, 10000, 144, 50000));

      executeDca(planId);

      const usdcxAfter = usdcxBalance(wallet1);
      expect(usdcxAfter).not.toStrictEqual(usdcxBefore);
    });

    it("rejects execution on inactive (paused) plan - E102", () => {
      mintSbtc(100000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 1000, 144, 5000));

      simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet1);
      const res = executeDca(planId);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(102)));
    });

    it("rejects execution before interval elapsed - E104", () => {
      mintSbtc(100000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 1000, 144, 5000));

      executeDca(planId); // first succeeds
      const res = executeDca(planId); // second fails
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(104)));
    });

    it("succeeds after interval has passed", () => {
      mintSbtc(100000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 1000, 144, 5000));

      executeDca(planId);
      simnet.mineEmptyBlocks(144);

      const res = executeDca(planId);
      expect(res.result).toStrictEqual(
        Cl.ok(Cl.tuple({
          "net-swapped": Cl.uint(997),
          "protocol-fee": Cl.uint(3),
          "swaps-done": Cl.uint(2),
          "bal-remaining": Cl.uint(3000),
        }))
      );
    });

    it("auto-deactivates plan when remaining balance < swap amount", () => {
      mintSbtc(100000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 1000, 144, 1000));

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

      mintSbtc(100000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 1000, 144, 5000));
      executeDca(planId);

      const teAfter = simnet.getDataVar(VAULT, "tse");
      expect(teAfter).not.toStrictEqual(teBefore);
    });
  });

  // ---- PAUSE / RESUME ----
  describe("pause-plan", () => {
    it("pauses an active plan", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.ok(Cl.bool(true)));

      const canExec = simnet.callReadOnlyFn(VAULT, "can-execute", [Cl.uint(planId)], deployer);
      expect(canExec.result).toStrictEqual(Cl.bool(false));
    });

    it("rejects pause from non-owner - E100", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet2);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(100)));
    });

    it("rejects pause on already paused plan - E102", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));
      simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet1);

      const res = simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(102)));
    });
  });

  describe("resume-plan", () => {
    it("resumes a paused plan", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));
      simnet.callPublicFn(VAULT, "pause-plan", [Cl.uint(planId)], wallet1);

      const res = simnet.callPublicFn(VAULT, "resume-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.ok(Cl.bool(true)));
    });

    it("rejects resume on active plan - E102", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callPublicFn(VAULT, "resume-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(102)));
    });

    it("rejects resume when balance < amount - E103", () => {
      mintSbtc(100000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 1000, 144, 1000));

      executeDca(planId); // drains balance, auto-deactivates

      const res = simnet.callPublicFn(VAULT, "resume-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(103)));
    });
  });

  // ---- CANCEL ----
  describe("cancel-plan", () => {
    it("cancels plan and refunds remaining balance", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callPublicFn(VAULT, "cancel-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.ok(Cl.uint(500)));
    });

    it("rejects cancel from non-owner - E100", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callPublicFn(VAULT, "cancel-plan", [Cl.uint(planId)], wallet2);
      expect(res.result).toStrictEqual(Cl.error(Cl.uint(100)));
    });

    it("handles cancel with zero balance (already drained)", () => {
      mintSbtc(100000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 1000, 144, 1000));

      executeDca(planId); // drains to 0

      const res = simnet.callPublicFn(VAULT, "cancel-plan", [Cl.uint(planId)], wallet1);
      expect(res.result).toStrictEqual(Cl.ok(Cl.uint(0)));
    });
  });

  // ---- READ-ONLY FUNCTIONS ----
  describe("read-only functions", () => {
    it("remaining-swaps returns correct count", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callReadOnlyFn(VAULT, "remaining-swaps", [Cl.uint(planId)], deployer);
      expect(res.result).toStrictEqual(Cl.ok(Cl.uint(5))); // 500 / 100 = 5
    });

    it("can-execute returns true for executable plan", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callReadOnlyFn(VAULT, "can-execute", [Cl.uint(planId)], deployer);
      expect(res.result).toStrictEqual(Cl.bool(true));
    });

    it("can-execute returns false for non-existent plan", () => {
      const res = simnet.callReadOnlyFn(VAULT, "can-execute", [Cl.uint(99999)], deployer);
      expect(res.result).toStrictEqual(Cl.bool(false));
    });

    it("next-execution-block returns ok for new plan", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callReadOnlyFn(VAULT, "next-execution-block", [Cl.uint(planId)], deployer);
      expect(res.result.type).toBe("ok");
    });

    it("get-user-plans returns list of plan IDs", () => {
      mintSbtc(10000, wallet1);
      const planId = extractPlanId(createPlan(wallet1, 100, 144, 500));

      const res = simnet.callReadOnlyFn(VAULT, "get-user-plans", [Cl.principal(wallet1)], deployer);
      // Result is a list type containing uints
      expect(res.result.type).toBe("list");
      const list = (res.result as any).value;
      // The plan we just created should be in the list
      const ids = list.map((v: any) => Number(v.value));
      expect(ids).toContain(planId);
    });
  });
});
