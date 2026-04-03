# DCA Batch Executor — Design Spec

**Date:** 2026-04-03  
**Status:** Approved  
**Target:** Mainnet

---

## Problem

The keeper bot currently executes each DCA plan as an individual Stacks transaction:

- **N plans → N transactions** → N × 0.015 STX in fees
- **`TooMuchChaining` errors** force a 4-second sleep between each execution
- **Complex nonce management** with retry logic for nonce conflicts
- **Slow**: 10 plans = ~55 seconds total execution time
- **Two separate GitHub Actions workflows** run independently for each vault

As the number of users grows, these problems compound. The goal is to replace this with a single batched transaction per keeper bot run.

---

## Solution Overview

Deploy a new **`batch-dca-executor.clar`** contract that acts as an orchestrator. It accepts a list of plan IDs (with vault type), then calls `execute-dca` on each existing vault contract in a single transaction using `fold`.

The existing vault contracts (`dca-vault`, `dca-vault-sbtc-v2`) are **not modified**.

```
Before:
  Keeper Bot → tx1: dca-vault.execute-dca(1)        [0.015 STX]
             → tx2: dca-vault.execute-dca(2)        [0.015 STX]
             → tx3: dca-vault-sbtc-v2.execute-dca(3) [0.015 STX]

After:
  Keeper Bot → tx1: batch-dca-executor.batch-execute-dca([
                 {plan-id: 1, vault-type: 0},
                 {plan-id: 2, vault-type: 0},
                 {plan-id: 3, vault-type: 1},
               ])                                   [~0.031 STX]
```

---

## Component 1: `batch-dca-executor.clar`

### Location
`contracts/batch-dca-executor.clar`

### Constants

```clarity
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
```

### Error codes

| Code | Meaning |
|------|---------|
| `u100` | Empty list passed |

### Public function: `batch-execute-dca`

```
(batch-execute-dca
  plans: (list 50 {plan-id: uint, vault-type: uint})
) → (response {success: uint, failed: uint} uint)
```

- Asserts list is non-empty, else `(err u100)`
- Folds over each item calling `execute-single`
- Returns accumulated `{success, failed}` count

### Private function: `execute-single`

```
(execute-single
  item: {plan-id: uint, vault-type: uint}
  acc:  {success: uint, failed: uint}
) → {success: uint, failed: uint}
```

- Routes to `VAULT-STX` or `VAULT-SBTC` based on `vault-type`
- Uses `match` on the inner `execute-dca` call:
  - On success: increments `success` counter
  - On error: increments `failed` counter — **does not revert the batch**
- `vault-type` outside `{u0, u1}` treated as vault-1 (sbtc) by if/else — not a critical path

### Read-only: `get-max-batch`
Returns `(ok u50)`. Lets the bot query the limit dynamically.

### Design decisions

| Decision | Reason |
|----------|--------|
| Vault addresses hardcoded | Deployed vaults have no shared trait; dynamic dispatch not available without one |
| Router hardcoded per vault-type | Each vault always uses the same router; reduces bot complexity |
| `MIN-AMOUNT-OUT = u1` | Matches current bot default; slippage protection handled at vault level |
| No access control | Vaults own the execution checks; any caller is fine |
| `match` not `try!` | Partial failure must not block the rest of the batch |

### Clarity call depth analysis

```
batch-executor (depth 1)
  └─ vault (depth 2)
       └─ swap-router (depth 3)
            └─ token-contract (depth 4)
```

Stacks allows up to 7 levels of inter-contract calls. Depth of 4 is safe.

---

## Component 2: Keeper Bot Refactor

### Files changed

| File | Change |
|------|--------|
| `nonce-manager.ts` | **Delete** — single tx per run, nonce management unnecessary |
| `executor.ts` | **Replace** with `batch-executor.ts` |
| `stacks-client.ts` | Generalize `getExecutablePlanIds` to accept any vault; add `getExecutablePlansForBothVaults` |
| `config.ts` | Remove `contractName`, `swapRouter`; add `batchExecutorContract` |
| `index.ts` | Simplify main loop — remove for loop, sleep(4000), NonceManager |

### New file: `batch-executor.ts`

```typescript
interface BatchPlan {
  planId: number;
  vaultType: 0 | 1; // 0 = dca-vault, 1 = dca-vault-sbtc-v2
}

class BatchExecutor {
  // Sends a single tx to batch-dca-executor
  async executeBatch(plans: BatchPlan[]): Promise<string>

  // Retries broadcast up to 3 times on network failure
  async executeBatchWithRetry(plans: BatchPlan[]): Promise<{ txid: string } | null>
}
```

**Fee calculation:**
```
base fee: 25,000 uSTX
per-plan overhead: 2,000 uSTX
fee = base + (plans.length × per_plan_overhead)
```
A batch of 10 plans = 45,000 uSTX (~0.045 STX). Still far cheaper than 10 × 15,000 = 150,000 uSTX.

### Batch chunking (>50 plans)

If `plans.length > 50`, split into chunks and send sequentially:

```typescript
const chunks = chunkArray(plans, 50); // [[p1..p50], [p51..p60]]
for (const chunk of chunks) {
  await executor.executeBatchWithRetry(chunk);
  // nonce increments manually between chunks (+1 per sent tx)
}
```

Nonce management is only needed when >50 plans exist — a rare edge case.

### Failure handling matrix

| Scenario | Handling |
|---------|---------|
| Individual plan fails inside batch | `match` in Clarity → skip, continue |
| Broadcast network error | Retry up to 3× with 2s / 5s / 10s backoff |
| All retries exhausted | Log plan IDs attempted, exit with code 1 |
| >50 plans → multiple chunks | Send sequentially, increment nonce manually |
| On-chain tx fails (post-broadcast) | Next cron cycle (10 min) retries all missed plans naturally |
| `success=0, failed=N` result | Log as WARN — all plans failed this cycle |

### Updated `index.ts` flow

```
1. Load config
2. Check keeper balance (warn if < 0.1 STX)
3. Query dca-vault total plans
4. Query dca-vault-sbtc-v2 total plans
5. Scan both vaults for executable plan IDs → BatchPlan[]
6. If empty → exit 0
7. Chunk into batches of ≤50
8. For each chunk: executeBatchWithRetry()
9. Log final {success, failed, total}
10. Exit 1 if any chunk failed after retries
```

### Updated `config.ts`

```typescript
export interface BotConfig {
  keeperPrivateKey:       string;
  keeperAddress:          string;
  batchExecutorContract:  string; // "SP2CMK....batch-dca-executor"
  stxVaultContract:       string; // "SP2CMK....dca-vault"
  sbtcVaultContract:      string; // "SP2CMK....dca-vault-sbtc-v2"
  hiroApiUrl:             string;
  minAmountOut:           number;
}
```

---

## Component 3: GitHub Actions

### Current state
Two separate workflows:
- `keeper-bot.yml` — targets `dca-vault-sbtc-v2`
- `keeper-bot-dca-vault.yml` — targets `dca-vault`

### After
**Merge into one workflow** `keeper-bot.yml`:

```yaml
name: DCA Keeper Bot — Batch
on:
  schedule:
    - cron: "*/10 * * * *"
  workflow_dispatch:
env:
  BATCH_EXECUTOR_CONTRACT: SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.batch-dca-executor
  STX_VAULT_CONTRACT:  SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault
  SBTC_VAULT_CONTRACT: SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2
```

Remove: `CONTRACT_NAME`, `SWAP_ROUTER` env vars.  
Keep: `KEEPER_PRIVATE_KEY`, `KEEPER_ADDRESS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

---

## Cost Comparison

| Metric | Before (10 plans) | After (10 plans) | Saving |
|--------|-------------------|------------------|--------|
| Transactions | 10 | 1 | −90% |
| Gas fee | 0.150 STX | ~0.045 STX | −70% |
| Execution time | ~55 sec | ~20 sec | −64% |
| Nonce errors | Frequent | Impossible | 100% |
| GitHub Actions jobs | 2 | 1 | −50% |

---

## Implementation Order

1. **Contract** — Write and test `batch-dca-executor.clar` locally with Clarinet
2. **Contract** — Deploy to mainnet, record address
3. **Bot** — Refactor keeper bot to use batch executor
4. **CI** — Merge GitHub Actions workflows, update env vars
5. **Monitor** — Watch first 3 runs, verify `success/failed` counts

---

## Out of Scope

- Modifying `dca-vault.clar` or `dca-vault-sbtc-v2.clar`
- User-facing frontend changes
- Waiting for on-chain tx confirmation in the bot
- Per-plan `min-amount-out` configuration (use `u1` flat)
