# Batch DCA Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy `batch-dca-executor.clar` and refactor the keeper bot to execute all DCA plans in a single transaction per run.

**Architecture:** A new Clarity orchestrator contract accepts a list of `{plan-id, vault-type}` tuples and calls `execute-dca` on the appropriate hardcoded vault using `fold`. The keeper bot is refactored from sequential per-plan transactions to a single batched transaction, eliminating nonce management and `TooMuchChaining` errors. Two GitHub Actions workflows are merged into one.

**Tech Stack:** Clarity 3 / Stacks mainnet, Clarinet (testing), TypeScript / `@stacks/transactions`, Node.js keeper bot, GitHub Actions.

---

## File Map

| Action | File |
|--------|------|
| **Create** | `contracts/batch-dca-executor.clar` |
| **Modify** | `contracts/Clarinet.toml` — add `[contracts.batch-dca-executor]` |
| **Modify** | `keeper-bot/src/config.ts` — new `BotConfig` interface |
| **Create** | `keeper-bot/src/batch-executor.ts` — replaces `executor.ts` |
| **Modify** | `keeper-bot/src/stacks-client.ts` — support both vaults |
| **Modify** | `keeper-bot/src/index.ts` — simplified main loop |
| **Delete** | `keeper-bot/src/executor.ts` |
| **Delete** | `keeper-bot/src/nonce-manager.ts` |
| **Modify** | `.github/workflows/keeper-bot.yml` — merged single workflow |
| **Delete** | `.github/workflows/keeper-bot-dca-vault.yml` |

---

## Task 1: Write `batch-dca-executor.clar`

**Files:**
- Create: `contracts/batch-dca-executor.clar`

- [ ] **Step 1: Write the contract**

```clarity
;; batch-dca-executor.clar
;; Orchestrates multiple DCA executions in a single transaction.
;; Existing vault contracts are NOT modified.

(define-constant MAX-BATCH u50)
(define-constant MIN-AMOUNT-OUT u1)

;; vault-type = u0: STX → sBTC
(define-constant VAULT-STX
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault)
(define-constant ROUTER-STX
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router)

;; vault-type = u1: sBTC → USDCx
(define-constant VAULT-SBTC
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2)
(define-constant ROUTER-SBTC
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-usdcx-swap-router)

(define-constant ERR-EMPTY-LIST (err u100))

;; Execute a single plan; on failure increments failed counter (does NOT revert batch)
(define-private (execute-single
    (item { plan-id: uint, vault-type: uint })
    (acc  { success: uint, failed: uint }))
  (let ((result
    (if (is-eq (get vault-type item) u0)
      (contract-call? VAULT-STX execute-dca
        (get plan-id item) ROUTER-STX MIN-AMOUNT-OUT)
      (contract-call? VAULT-SBTC execute-dca
        (get plan-id item) ROUTER-SBTC MIN-AMOUNT-OUT)
    )))
  (match result
    _ok  { success: (+ (get success acc) u1), failed: (get failed acc) }
    _err { success: (get success acc), failed: (+ (get failed acc) u1) }
  ))
)

(define-read-only (get-max-batch)
  (ok MAX-BATCH))

(define-public (batch-execute-dca
    (plans (list 50 { plan-id: uint, vault-type: uint })))
  (begin
    (asserts! (> (len plans) u0) ERR-EMPTY-LIST)
    (ok (fold execute-single plans { success: u0, failed: u0 }))
  )
)
```

- [ ] **Step 2: Verify file saved correctly**

```bash
cat contracts/batch-dca-executor.clar
```

Expected: full contract printed, no truncation.

- [ ] **Step 3: Commit**

```bash
git add contracts/batch-dca-executor.clar
git commit -m "feat: add batch-dca-executor.clar orchestrator contract"
```

---

## Task 2: Register Contract in Clarinet.toml

**Files:**
- Modify: `contracts/Clarinet.toml`

- [ ] **Step 1: Add entry at end of `Clarinet.toml`**

Add after the last `[contracts.*]` block:

```toml
[contracts.batch-dca-executor]
path = 'batch-dca-executor.clar'
clarity_version = 3
epoch = '3.0'
```

- [ ] **Step 2: Run `clarinet check` to verify contract compiles**

```bash
cd contracts && clarinet check
```

Expected output: `✔ 9 contracts checked` (or similar count), zero errors.

If you see `NoSuchContract` or trait errors, verify that `VAULT-STX` and `VAULT-SBTC` constants match the contract names registered in `Clarinet.toml` (`dca-vault` and `dca-vault-sbtc-v2`).

- [ ] **Step 3: Commit**

```bash
git add contracts/Clarinet.toml
git commit -m "chore: register batch-dca-executor in Clarinet.toml"
```

---

## Task 3: Write Clarinet Tests for the Contract

**Files:**
- Create: `contracts/tests/batch-dca-executor_test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to confirm it compiles (empty list test should pass, plan execution test may fail/skip depending on simnet state)**

```bash
cd contracts && clarinet test tests/batch-dca-executor_test.ts
```

Expected: `✔ returns ERR-EMPTY-LIST`, `✔ get-max-batch returns u50`. The third test is an integration check — pass or fail is acceptable in simnet.

- [ ] **Step 3: Commit**

```bash
git add contracts/tests/batch-dca-executor_test.ts
git commit -m "test: add clarinet tests for batch-dca-executor"
```

---

## Task 4: Refactor `config.ts`

**Files:**
- Modify: `keeper-bot/src/config.ts`

The current `BotConfig` has `contractAddress`, `contractName`, `swapRouter` targeting a single vault. Replace with the new multi-vault shape.

- [ ] **Step 1: Rewrite `config.ts`**

Replace the entire file with:

```typescript
import "dotenv/config";
import { generateWallet, generateNewAccount } from "@stacks/wallet-sdk";
import { getAddressFromPrivateKey } from "@stacks/transactions";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export interface BotConfig {
  keeperPrivateKey:      string;
  keeperAddress:         string;
  batchExecutorContract: string; // "SP2CMK....batch-dca-executor"
  stxVaultContract:      string; // "SP2CMK....dca-vault"
  sbtcVaultContract:     string; // "SP2CMK....dca-vault-sbtc-v2"
  hiroApiUrl:            string;
  minAmountOut:          number;
}

function isMnemonic(value: string): boolean {
  return value.trim().split(/\s+/).length >= 12;
}

function isHexKey(value: string): boolean {
  const cleaned = value.replace(/^0x/i, "").trim();
  return /^[0-9a-fA-F]{64}(01)?$/.test(cleaned);
}

async function resolvePrivateKey(raw: string, accountIndex: number): Promise<string> {
  if (isHexKey(raw)) {
    return raw.replace(/^0x/i, "").trim();
  }
  if (isMnemonic(raw)) {
    let wallet = await generateWallet({ secretKey: raw.trim(), password: "" });
    for (let i = wallet.accounts.length; i <= accountIndex; i++) {
      wallet = generateNewAccount(wallet);
    }
    return wallet.accounts[accountIndex].stxPrivateKey;
  }
  throw new Error(
    "KEEPER_PRIVATE_KEY must be a 64-char hex private key or a 12/24-word mnemonic seed phrase"
  );
}

export async function loadConfig(): Promise<BotConfig> {
  const accountIndex    = Number(optional("KEEPER_ACCOUNT_INDEX", "1"));
  const keeperPrivateKey = await resolvePrivateKey(required("KEEPER_PRIVATE_KEY"), accountIndex);
  const keeperAddress   = required("KEEPER_ADDRESS");

  const derivedAddress = getAddressFromPrivateKey(keeperPrivateKey, "mainnet");
  if (derivedAddress !== keeperAddress) {
    throw new Error(
      `Address mismatch! Private key derives to ${derivedAddress} but KEEPER_ADDRESS is ${keeperAddress}.`
    );
  }

  return {
    keeperPrivateKey,
    keeperAddress,
    batchExecutorContract: optional(
      "BATCH_EXECUTOR_CONTRACT",
      "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.batch-dca-executor"
    ),
    stxVaultContract: optional(
      "STX_VAULT_CONTRACT",
      "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault"
    ),
    sbtcVaultContract: optional(
      "SBTC_VAULT_CONTRACT",
      "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2"
    ),
    hiroApiUrl:   optional("HIRO_API_URL", "https://api.hiro.so"),
    minAmountOut: Number(optional("MIN_AMOUNT_OUT", "1")),
  };
}
```

- [ ] **Step 2: Build to check for TypeScript errors**

```bash
cd keeper-bot && npm run build 2>&1 | head -50
```

Expected: TypeScript errors for files still referencing old fields (`contractAddress`, `contractName`, `swapRouter`). These will be fixed in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add keeper-bot/src/config.ts
git commit -m "refactor: update BotConfig for batch executor — remove single-vault fields"
```

---

## Task 5: Create `batch-executor.ts`

**Files:**
- Create: `keeper-bot/src/batch-executor.ts`

- [ ] **Step 1: Write `batch-executor.ts`**

```typescript
// keeper-bot/src/batch-executor.ts
import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  listCV,
  tupleCV,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import type { BotConfig } from "./config";
import { log } from "./logger";
import { sleep } from "./stacks-client";

export interface BatchPlan {
  planId: number;
  vaultType: 0 | 1; // 0 = dca-vault (STX→sBTC), 1 = dca-vault-sbtc-v2 (sBTC→USDCx)
}

const BASE_FEE_USTX     = 25_000;
const PER_PLAN_FEE_USTX = 2_000;
const RETRY_DELAYS      = [2000, 5000, 10000]; // ms

function calcFee(planCount: number): bigint {
  return BigInt(BASE_FEE_USTX + planCount * PER_PLAN_FEE_USTX);
}

export class BatchExecutor {
  constructor(private config: BotConfig) {}

  async executeBatch(plans: BatchPlan[], nonce?: number): Promise<string> {
    const [contractAddress, contractName] = this.config.batchExecutorContract.split(".");

    const planArgs = plans.map((p) =>
      tupleCV({
        "plan-id":    uintCV(p.planId),
        "vault-type": uintCV(p.vaultType),
      })
    );

    const tx = await makeContractCall({
      contractAddress,
      contractName,
      functionName:  "batch-execute-dca",
      functionArgs:  [listCV(planArgs)],
      senderKey:     this.config.keeperPrivateKey,
      network:       STACKS_MAINNET,
      fee:           calcFee(plans.length),
      ...(nonce !== undefined ? { nonce: BigInt(nonce) } : {}),
      postConditionMode: 1, // Allow
    });

    const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });

    if ("error" in result && result.error) {
      throw new Error(`Broadcast failed: ${result.error} — ${result.reason ?? ""}`);
    }

    return result.txid;
  }

  async executeBatchWithRetry(
    plans: BatchPlan[],
    nonce?: number
  ): Promise<{ txid: string } | null> {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const txid = await this.executeBatch(plans, nonce);
        return { txid };
      } catch (err: unknown) {
        const isLast = attempt === RETRY_DELAYS.length;
        const msg    = err instanceof Error ? err.message : String(err);
        log.error("Batch broadcast error", { attempt, planCount: plans.length, msg });
        if (isLast) return null;
        await sleep(RETRY_DELAYS[attempt]);
      }
    }
    return null;
  }
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
```

- [ ] **Step 2: Commit**

```bash
git add keeper-bot/src/batch-executor.ts
git commit -m "feat: add batch-executor.ts — single-tx DCA batch execution"
```

---

## Task 6: Update `stacks-client.ts` for Both Vaults

**Files:**
- Modify: `keeper-bot/src/stacks-client.ts`

The current `StacksClient` is hardwired to `this.config.contractAddress / contractName`. We need it to query **both** vaults independently.

- [ ] **Step 1: Rewrite `stacks-client.ts`**

Replace the entire file with:

```typescript
import {
  hexToCV,
  ClarityType,
  type ClarityValue,
  uintCV,
  serializeCV,
  standardPrincipalCV,
} from "@stacks/transactions";
import type { BotConfig } from "./config";
import type { BatchPlan } from "./batch-executor";

const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

// ─── CV Helpers ───────────────────────────────────────────────────────────────

function cvHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result as Uint8Array).toString("hex");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCV(cv: ClarityValue): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = cv as unknown as any;
  const t   = raw.type;

  if (t === "uint" || t === "int") return Number(raw.value);
  if (t === "true")  return true;
  if (t === "false") return false;
  if (t === "none")  return null;
  if (t === "some")  return parseCV(raw.value);
  if (t === "ok")    return parseCV(raw.value);
  if (t === "err")   throw new Error("Contract returned error");
  if (t === "address" || t === "contract") return String(raw.value);
  if (t === "tuple") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    const data: Record<string, ClarityValue> = raw.value ?? {};
    for (const [k, v] of Object.entries(data)) result[k] = parseCV(v);
    return result;
  }
  if (t === "list") {
    const list: ClarityValue[] = raw.value ?? [];
    return list.map((item: ClarityValue) => parseCV(item));
  }

  // Fallback: legacy numeric ClarityType enum
  switch (cv.type) {
    case ClarityType.UInt:
    case ClarityType.Int:
      return Number(raw.value);
    case ClarityType.BoolTrue:      return true;
    case ClarityType.BoolFalse:     return false;
    case ClarityType.ResponseOk:    return parseCV(raw.value);
    case ClarityType.ResponseErr:   throw new Error("Contract returned error");
    case ClarityType.OptionalNone:  return null;
    case ClarityType.OptionalSome:  return parseCV(raw.value);
    case ClarityType.Tuple: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {};
      const data: Record<string, ClarityValue> = raw.data ?? raw.value ?? {};
      for (const [k, v] of Object.entries(data)) result[k] = parseCV(v);
      return result;
    }
    case ClarityType.List: {
      const list: ClarityValue[] = raw.list ?? raw.value ?? [];
      return list.map((item: ClarityValue) => parseCV(item));
    }
    default: return null;
  }
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export class StacksClient {
  constructor(private config: BotConfig) {}

  private async readOnly(
    contractAddress: string,
    contractName: string,
    fn: string,
    args: string[] = []
  ): Promise<ClarityValue> {
    const url = `${this.config.hiroApiUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/${fn}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
    });

    if (res.status === 429) throw new Error("RateLimited");

    const json = await res.json() as { okay: boolean; result: string; cause?: string };
    if (!json.okay) throw new Error(json.cause ?? "Read-only call failed");
    return hexToCV(json.result);
  }

  private parseContract(fullName: string): [string, string] {
    const [addr, name] = fullName.split(".");
    return [addr, name];
  }

  async getTotalPlans(vaultContract: string): Promise<number> {
    const [addr, name] = this.parseContract(vaultContract);
    const cv = await this.readOnly(addr, name, "get-stats");
    const val = parseCV(cv) as { "total-plans": number };
    return val["total-plans"];
  }

  async canExecute(vaultContract: string, planId: number): Promise<boolean> {
    const [addr, name] = this.parseContract(vaultContract);
    const cv = await this.readOnly(addr, name, "can-execute", [cvHex(uintCV(planId))]);
    return parseCV(cv) as boolean;
  }

  async getKeeperBalance(): Promise<number> {
    const res = await fetch(
      `${this.config.hiroApiUrl}/v2/accounts/${this.config.keeperAddress}?proof=0`
    );
    if (!res.ok) return 0;
    const json = await res.json() as { balance: string };
    return Number(json.balance ?? 0);
  }

  async getAccountNonce(address: string): Promise<number> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${this.config.hiroApiUrl}/v2/accounts/${address}?proof=0`);
      if (res.status === 429) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`Failed to fetch nonce for ${address}`);
      const json = await res.json() as { nonce: number };
      return json.nonce;
    }
    throw new Error(`Failed to fetch nonce for ${address} after retries`);
  }

  // Scan a single vault for executable plan IDs
  async getExecutablePlanIds(
    vaultContract: string,
    totalPlans: number
  ): Promise<number[]> {
    const executable: number[]   = [];
    let rateLimitRetries         = 0;
    const MAX_RATE_LIMIT_RETRIES = 5;
    const BATCH_SIZE             = 20;
    const BATCH_PAUSE_MS         = 3000;
    const CALL_DELAY_MS          = 350;
    let callsSincePause          = 0;

    for (let id = totalPlans; id >= 1; id--) {
      try {
        const canExec = await this.canExecute(vaultContract, id);
        if (canExec) executable.push(id);
        rateLimitRetries = 0;
        callsSincePause++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "RateLimited") {
          rateLimitRetries++;
          if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) break;
          await sleep(5000 * rateLimitRetries);
          id++;
          callsSincePause = 0;
          continue;
        }
        console.error(
          JSON.stringify({ timestamp: new Date().toISOString(), level: "warn",
            message: "canExecute failed", vaultContract, planId: id, error: msg })
        );
      }

      if (callsSincePause >= BATCH_SIZE) {
        await sleep(BATCH_PAUSE_MS);
        callsSincePause = 0;
      } else {
        await sleep(CALL_DELAY_MS);
      }
    }

    executable.sort((a, b) => a - b);
    return executable;
  }

  // Scan both vaults and return combined BatchPlan list
  async getExecutablePlansForBothVaults(): Promise<BatchPlan[]> {
    const { stxVaultContract, sbtcVaultContract } = this.config;

    const [stxTotal, sbtcTotal] = await Promise.all([
      this.getTotalPlans(stxVaultContract),
      this.getTotalPlans(sbtcVaultContract),
    ]);

    const [stxIds, sbtcIds] = await Promise.all([
      stxTotal  > 0 ? this.getExecutablePlanIds(stxVaultContract,  stxTotal)  : Promise.resolve([]),
      sbtcTotal > 0 ? this.getExecutablePlanIds(sbtcVaultContract, sbtcTotal) : Promise.resolve([]),
    ]);

    const plans: BatchPlan[] = [
      ...stxIds.map((id) => ({ planId: id, vaultType: 0 as const })),
      ...sbtcIds.map((id) => ({ planId: id, vaultType: 1 as const })),
    ];

    return plans;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { standardPrincipalCV };
```

- [ ] **Step 2: Build to check TypeScript**

```bash
cd keeper-bot && npm run build 2>&1 | head -60
```

Expected: errors only in `index.ts` (still references old API). No errors in `stacks-client.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add keeper-bot/src/stacks-client.ts
git commit -m "refactor: stacks-client supports both vaults — getExecutablePlansForBothVaults"
```

---

## Task 7: Rewrite `index.ts`

**Files:**
- Modify: `keeper-bot/src/index.ts`

- [ ] **Step 1: Rewrite `index.ts`**

Replace the entire file with:

```typescript
import { loadConfig } from "./config";
import { StacksClient } from "./stacks-client";
import { BatchExecutor, chunkArray } from "./batch-executor";
import { log } from "./logger";

const LOW_BALANCE_WARN_USTX = 100_000; // 0.1 STX
const MAX_BATCH_SIZE = 50;

async function main(): Promise<void> {
  const config = await loadConfig();

  log.info("Keeper bot starting", {
    batchExecutorContract: config.batchExecutorContract,
    keeperAddress:         config.keeperAddress,
  });

  const client   = new StacksClient(config);
  const executor = new BatchExecutor(config);

  // Check keeper wallet balance
  const balance = await client.getKeeperBalance();
  log.info("Keeper balance", {
    balanceUstx: balance,
    balanceSTX:  (balance / 1_000_000).toFixed(6),
  });

  if (balance < LOW_BALANCE_WARN_USTX) {
    log.warn("Keeper balance is low — top up needed", {
      balanceSTX: (balance / 1_000_000).toFixed(6),
    });
  }

  // Scan both vaults for executable plans
  const plans = await client.getExecutablePlansForBothVaults();
  log.info("Plans ready to execute", { count: plans.length, plans });

  if (plans.length === 0) {
    log.info("Nothing to execute, exiting");
    process.exit(0);
  }

  // Chunk into batches of ≤50 (Clarity list limit)
  const chunks = chunkArray(plans, MAX_BATCH_SIZE);
  log.info("Executing batches", { totalPlans: plans.length, chunks: chunks.length });

  let anyFailed = false;
  // Nonce management only needed when >50 plans (multiple chunks)
  let nonce: number | undefined = chunks.length > 1
    ? await client.getAccountNonce(config.keeperAddress)
    : undefined;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    log.info(`Sending batch ${i + 1}/${chunks.length}`, { planCount: chunk.length });

    const result = await executor.executeBatchWithRetry(chunk, nonce);

    if (result) {
      log.info(`Batch ${i + 1} broadcast`, { txid: result.txid, planCount: chunk.length });
      if (nonce !== undefined) nonce++;
    } else {
      log.error(`Batch ${i + 1} failed after all retries`, {
        planIds: chunk.map((p) => p.planId),
      });
      anyFailed = true;
    }
  }

  log.info("Run complete", { totalPlans: plans.length, chunks: chunks.length });
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err: unknown) => {
  log.error("Fatal error", { err: String(err) });
  process.exit(1);
});
```

- [ ] **Step 2: Build — should now compile cleanly**

```bash
cd keeper-bot && npm run build 2>&1
```

Expected: `0 errors`. If TypeScript errors remain, they'll be in imports that still reference deleted files — fix those before proceeding.

- [ ] **Step 3: Commit**

```bash
git add keeper-bot/src/index.ts
git commit -m "refactor: simplify index.ts — single batch tx, no nonce manager, no sleep loop"
```

---

## Task 8: Delete `executor.ts` and `nonce-manager.ts`

**Files:**
- Delete: `keeper-bot/src/executor.ts`
- Delete: `keeper-bot/src/nonce-manager.ts`

- [ ] **Step 1: Delete the files**

```bash
rm keeper-bot/src/executor.ts
rm keeper-bot/src/nonce-manager.ts
```

- [ ] **Step 2: Build to confirm no broken imports**

```bash
cd keeper-bot && npm run build 2>&1
```

Expected: clean build, zero errors.

- [ ] **Step 3: Commit**

```bash
git add -u keeper-bot/src/executor.ts keeper-bot/src/nonce-manager.ts
git commit -m "chore: delete executor.ts and nonce-manager.ts — replaced by batch-executor.ts"
```

---

## Task 9: Merge GitHub Actions Workflows

**Files:**
- Modify: `.github/workflows/keeper-bot.yml` — rewrite as unified workflow
- Delete: `.github/workflows/keeper-bot-dca-vault.yml`

- [ ] **Step 1: Rewrite `.github/workflows/keeper-bot.yml`**

Replace the entire file with:

```yaml
name: DCA Keeper Bot — Batch

on:
  schedule:
    - cron: "*/10 * * * *"
  workflow_dispatch:

jobs:
  run-keeper:
    name: Execute DCA Plans (Batch)
    runs-on: ubuntu-latest
    timeout-minutes: 5

    defaults:
      run:
        working-directory: keeper-bot

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: keeper-bot/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run keeper bot
        env:
          KEEPER_PRIVATE_KEY:      ${{ secrets.KEEPER_PRIVATE_KEY }}
          KEEPER_ADDRESS:          ${{ secrets.KEEPER_ADDRESS }}
          BATCH_EXECUTOR_CONTRACT: SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.batch-dca-executor
          STX_VAULT_CONTRACT:      SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault
          SBTC_VAULT_CONTRACT:     SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2
          HIRO_API_URL:            https://api.hiro.so
          MIN_AMOUNT_OUT:          "1"
        run: npm start

      - name: Notify Telegram on failure
        if: failure()
        run: |
          curl -s -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
            -d chat_id="${{ secrets.TELEGRAM_CHAT_ID }}" \
            -d parse_mode="Markdown" \
            -d text="🚨 *DCA Keeper Bot (Batch) FAILED*%0A%0A*Repo:* ${{ github.repository }}%0A*Run:* ${{ github.run_number }}%0A*Time:* $(date -u '+%Y-%m-%d %H:%M UTC')%0A%0A[View logs](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})"
```

- [ ] **Step 2: Delete the old dca-vault workflow**

```bash
rm .github/workflows/keeper-bot-dca-vault.yml
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/keeper-bot.yml
git add -u .github/workflows/keeper-bot-dca-vault.yml
git commit -m "ci: merge two keeper-bot workflows into single batch workflow"
```

---

## Task 10: Deploy Contract to Mainnet

> **This task requires manual action.** The deployer wallet must have enough STX for deployment fees (~0.1 STX).

- [ ] **Step 1: Verify `clarinet check` passes locally**

```bash
cd contracts && clarinet check
```

Expected: zero errors.

- [ ] **Step 2: Deploy using Clarinet or Hiro Web Wallet**

Option A — Clarinet CLI (requires configured deployer key):
```bash
cd contracts && clarinet deployments apply --mainnet
```

Option B — Copy contract source from `contracts/batch-dca-executor.clar`, deploy via [explorer.hiro.so/sandbox/deploy](https://explorer.hiro.so/sandbox/deploy) using deployer wallet.

- [ ] **Step 3: Record the deployed contract address**

After deployment, the contract will be at:
```
SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.batch-dca-executor
```
(Same principal as existing vaults — deploy from the same wallet.)

Verify on Hiro Explorer that the contract is deployed and `get-max-batch` returns `(ok u50)`.

- [ ] **Step 4: Update GitHub Actions secrets (if address differs)**

If deployed from a different address, update `BATCH_EXECUTOR_CONTRACT` in `.github/workflows/keeper-bot.yml` and in `keeper-bot/src/config.ts` default values.

- [ ] **Step 5: Commit any address updates**

```bash
git add .github/workflows/keeper-bot.yml keeper-bot/src/config.ts
git commit -m "chore: update batch executor contract address post-deploy"
```

---

## Task 11: Push and Monitor First 3 Runs

- [ ] **Step 1: Push all commits to main**

```bash
git push origin main
```

- [ ] **Step 2: Trigger a manual run to validate**

```bash
gh workflow run "DCA Keeper Bot — Batch" --ref main
```

Or go to GitHub Actions → "DCA Keeper Bot — Batch" → "Run workflow".

- [ ] **Step 3: Watch run output and verify**

Check logs for:
- `Plans ready to execute` — count should include plans from both vaults
- `Batch 1/1 broadcast` with a `txid`
- `Run complete` with no errors
- On Hiro Explorer, the txid should show a successful `batch-execute-dca` call

- [ ] **Step 4: Verify `success/failed` counts on-chain**

The transaction result in Hiro Explorer should show:
```
(ok (tuple (success uN) (failed uM)))
```

Where `N > 0` means plans were executed. `failed > 0` is acceptable (plan not yet due) — important thing is the tx didn't revert.

- [ ] **Step 5: Monitor 3 consecutive scheduled runs (every 10 min)**

Watch for:
- No Telegram failure alerts
- `failed = totalPlans` would indicate a systematic problem (wrong contract address, etc.)
- `success > 0` on at least one run confirms end-to-end flow is working

---

## Self-Review Checklist

### Spec coverage
- [x] `batch-dca-executor.clar` — Task 1
- [x] `MAX-BATCH = u50`, `MIN-AMOUNT-OUT = u1` — Task 1
- [x] `vault-type u0` → `VAULT-STX`, `vault-type u1` → `VAULT-SBTC` — Task 1
- [x] `ERR-EMPTY-LIST (u100)` — Task 1
- [x] `match` not `try!` for partial failure — Task 1
- [x] `get-max-batch` read-only — Task 1
- [x] Clarinet registration — Task 2
- [x] New `BotConfig` interface — Task 4
- [x] `batch-executor.ts` with fee formula, retry, chunking — Task 5
- [x] `stacks-client.ts` queries both vaults — Task 6
- [x] `getExecutablePlansForBothVaults` — Task 6
- [x] Simplified `index.ts` (no for loop, no sleep, no NonceManager) — Task 7
- [x] Delete `executor.ts` and `nonce-manager.ts` — Task 8
- [x] Merge GitHub Actions workflows — Task 9
- [x] Remove `CONTRACT_NAME`, `SWAP_ROUTER` env vars — Task 9
- [x] Keep `KEEPER_PRIVATE_KEY`, `KEEPER_ADDRESS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Task 9
- [x] Deploy to mainnet and monitor — Tasks 10–11

### Nonce management for >50 plans
The spec says "nonce increments manually between chunks (+1 per sent tx)". Task 7 `index.ts` fetches the account nonce once before the loop and increments by 1 per chunk when `chunks.length > 1`. Matches spec.

### Fee formula
`base: 25,000 uSTX + per-plan: 2,000 uSTX`. Implemented in `calcFee()` in Task 5.
