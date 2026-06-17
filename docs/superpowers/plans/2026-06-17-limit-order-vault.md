# Limit Order Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a non-custodial one-shot STX→sBTC limit-buy feature: deposit STX with a target USD price, the keeper executes the swap when price drops to target, good-til-cancelled.

**Architecture:** A standalone `limit-order-vault.clar` (modeled on `dca-vault.clar`, no interval) holds STX; the keeper watches sBTC USD price and calls permissionless `execute-order` with a `min-amount-out` slippage guard when its off-chain condition is met. Reads flow through the existing portfolio snapshot; the keeper reuses its price feed, broadcast, reconcile, and push infrastructure.

**Tech Stack:** Clarity 3 + Clarinet SDK (vitest simnet), Next.js 15 App Router, TypeScript, Zustand (`walletStore`), `@stacks/connect` + `@stacks/transactions`, next-intl (en/vi/zh/ja), keeper-bot (Node + Upstash Redis), Playwright.

## Global Constraints

- v1 pair is **STX→sBTC only**. USDCx→sBTC is out of scope (needs a new on-chain reverse router first).
- Min deposit `MID = u2000000` (2 STX); max **open** orders per user `MPPU = u10`.
- Protocol fee 0.3%: `PFBPS = u30`, `BPSB = u10000`. Treasury `'SP2DZKR60CN5QKJQT18T8ZMSERGA6R4QKHEM5QT1W`.
- `target-usd` is stored as micro-USD (USD × 1e6); it is **NOT enforced on-chain** — it is audit/UI data. The on-chain guard is `min-amount-out` passed by the keeper at execution.
- `execute-order` is permissionless (safe: `min-amount-out` guards price; sBTC goes straight to owner).
- Mainnet contract id: `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.limit-order-vault`. Execution router: `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router` (`swap-stx-for-token`).
- Commit directly on `main`, fine-grained RED/GREEN commits, **no `Co-Authored-By` trailer** (memory: feedback_commits).
- Gates: `cd contracts && npm test` (contract), `npm test` (frontend unit), `npm run build`, `npm run test:e2e` (baseline ~84 desktop / ~78 mobile). Keeper: `cd keeper-bot && npm run build` + its vitest.
- i18n parity test requires the new namespace in **all four** of `messages/{en,vi,zh,ja}.json`.
- Do NOT run `shadcn add button/card/input/badge/skeleton` (macOS filename collision — memory guardrail). Use existing `glass-card` + CSS-var styling like `trade/page.tsx`.
- Reads use the snapshot pattern (extend `portfolio-snapshot.ts` + `usePortfolioSnapshot.ts`), not new SWR hooks.

---

## File Structure

**Contracts** (`contracts/`)
- Create `limit-order-vault.clar` — the vault (network-agnostic: router is a trait param, target token is a principal param, so it runs unchanged in simnet).
- Create `mock-stx-sbtc-router.clar` — test router implementing the vault trait, mints `mock-sbtc`.
- Modify `Clarinet.toml.test` — register both new contracts.
- Modify `Clarinet.toml` — register `limit-order-vault` for check/deploy.
- Create `tests/limit-order-vault.test.ts` — simnet unit tests.

**Frontend lib** (`src/lib/`)
- Create `limit-orders.ts` — pure validation + types + micro conversions + `openContractCall` wrappers.
- Create `limit-orders.test.ts` — validation unit tests.

**Frontend server/hooks**
- Modify `src/lib/server/portfolio-snapshot.ts` — add `limitOrders` to the snapshot.
- Create `src/lib/server/limit-orders-read.ts` — server read-only fetch + clarity tuple parse.
- Create `src/lib/server/limit-orders-read.test.ts` — parser unit test.
- Modify `src/hooks/usePortfolioSnapshot.ts` — `useLimitOrders()` selector.

**Frontend components** (`src/components/limit/`)
- Create `LimitOrderCard.tsx`, `MyLimitOrders.tsx`, `CreateLimitOrderForm.tsx`.
- Modify `src/app/[locale]/trade/page.tsx` — add a Limit Orders card section.

**i18n**
- Modify `messages/{en,vi,zh,ja}.json` — add `limit` namespace.

**Keeper** (`keeper-bot/src/`)
- Modify `config.ts` — `limitOrderVaultContract`, `limitSlippageBps`.
- Modify `stacks-client.ts` — `getExecutableLimitOrders()`.
- Create `limit-push.ts` + `limit-push.test.ts` — trigger eval + minOut calc.
- Modify `index.ts` — wire into `runOnce()`.

**E2E** (`e2e/`)
- Create `limit-orders.spec.ts`.

**Deploy** — `contracts/deployments` + env vars.

---

## Task 1: Contract scaffold + `create-order`

**Files:**
- Create: `contracts/limit-order-vault.clar`
- Create: `contracts/mock-stx-sbtc-router.clar`
- Modify: `contracts/Clarinet.toml.test`
- Test: `contracts/tests/limit-order-vault.test.ts`

**Interfaces:**
- Produces: `create-order(target-token principal, deposit-amount uint, target-usd uint) -> (response uint uint)` returning the new order id; read-onlys `get-order(uint)`, `get-user-orders(principal)`, `get-open-order-count(principal)`, `get-stats()`.
- Consumes: `mock-sbtc.mint(uint, principal)` (exists), Clarinet SDK simnet.

- [ ] **Step 1: Write the vault contract**

Create `contracts/limit-order-vault.clar`:

```clarity
;; limit-order-vault: non-custodial one-shot STX->sBTC limit-buy vault.
;; User deposits STX with a target USD price (stored for audit/UI only — NOT
;; enforced on-chain). The keeper executes a one-shot swap when its off-chain
;; price condition is met; min-amount-out is the on-chain slippage/trust guard.
;; Orders are good-til-cancelled.

(define-trait dca-swap-trait
  (
    (swap-stx-for-token (uint uint principal) (response uint uint))
  )
)

(define-constant E100 (err u100)) ;; not authorized
(define-constant E101 (err u101)) ;; order not found
(define-constant E102 (err u102)) ;; order not open
(define-constant E105 (err u105)) ;; invalid target-usd
(define-constant E107 (err u107)) ;; max open orders reached
(define-constant E109 (err u109)) ;; deposit too small

(define-constant MID   u2000000)  ;; min initial deposit: 2 STX
(define-constant PFBPS u30)       ;; protocol fee: 30 bps = 0.3%
(define-constant BPSB  u10000)
(define-constant MPPU  u10)       ;; max OPEN orders per user
(define-constant TREASURY 'SP2DZKR60CN5QKJQT18T8ZMSERGA6R4QKHEM5QT1W)

(define-constant STATUS-OPEN      u0)
(define-constant STATUS-FILLED    u1)
(define-constant STATUS-CANCELLED u2)

(define-data-var oc   uint u0)  ;; order counter
(define-data-var tvol uint u0)  ;; total uSTX filled
(define-data-var toe  uint u0)  ;; total orders executed

(define-map orders uint {
  owner:      principal,
  token:      principal,
  amt:        uint,
  target-usd: uint,
  status:     uint,
  cat:        uint,
  fab:        uint
})

(define-map uids principal (list 10 uint))
(define-map open-cnt principal uint)

(define-private (protocol-fee (a uint)) (/ (* a PFBPS) BPSB))

(define-private (oc-of (u principal)) (default-to u0 (map-get? open-cnt u)))

(define-private (add-uid (u principal) (id uint))
  (let ((ex (default-to (list) (map-get? uids u)))
        (up (unwrap-panic (as-max-len? (append ex id) u10))))
    (map-set uids u up)))

(define-public (create-order
    (target-token  principal)
    (deposit-amount uint)
    (target-usd    uint))
  (let ((id (+ (var-get oc) u1))
        (n  (oc-of tx-sender)))
    (asserts! (>= deposit-amount MID) E109)
    (asserts! (> target-usd u0)       E105)
    (asserts! (< n MPPU)              E107)
    (try! (stx-transfer? deposit-amount tx-sender (as-contract tx-sender)))
    (map-set orders id {
      owner: tx-sender, token: target-token,
      amt: deposit-amount, target-usd: target-usd,
      status: STATUS-OPEN, cat: stacks-block-height, fab: u0
    })
    (var-set oc id)
    (map-set open-cnt tx-sender (+ n u1))
    (add-uid tx-sender id)
    (print { event: "order-created", order-id: id, owner: tx-sender,
             token: target-token, amt: deposit-amount, target-usd: target-usd })
    (ok id)))

(define-read-only (get-order (order-id uint)) (map-get? orders order-id))
(define-read-only (get-user-orders (user principal)) (default-to (list) (map-get? uids user)))
(define-read-only (get-open-order-count (user principal)) (oc-of user))
(define-read-only (get-stats)
  { oc: (var-get oc), tvol: (var-get tvol), toe: (var-get toe) })
```

(`execute-order` and `cancel-order` are added in Tasks 2 and 3.)

- [ ] **Step 2: Write the mock router**

Create `contracts/mock-stx-sbtc-router.clar`:

```clarity
;; mock-stx-sbtc-router: test-only swap router. Mints mock-sbtc 1:1 to recipient.
;; Asserts the minted amount >= min-amount-out so tests can drive the slippage revert.
(impl-trait .limit-order-vault.dca-swap-trait)

(define-public (swap-stx-for-token
    (amount-in      uint)
    (min-amount-out uint)
    (recipient      principal))
  (begin
    (asserts! (>= amount-in min-amount-out) (err u999))
    (try! (contract-call? .mock-sbtc mint amount-in recipient))
    (ok amount-in)))
```

- [ ] **Step 3: Register both contracts in the test manifest**

In `contracts/Clarinet.toml.test`, append:

```toml
[contracts.limit-order-vault]
path = 'limit-order-vault.clar'
clarity_version = 3
epoch = 3.1

[contracts.mock-stx-sbtc-router]
path = 'mock-stx-sbtc-router.clar'
clarity_version = 3
epoch = 3.1
```

(Match the `clarity_version`/`epoch` of the existing entries in the file; copy them from `[contracts.test-dca-vault-sbtc]` if they differ.)

- [ ] **Step 4: Write the failing create-order tests**

Create `contracts/tests/limit-order-vault.test.ts`:

```typescript
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
    expect(res.result).toBeErr(Cl.uint(109));
  });

  it("rejects target-usd of zero", () => {
    const res = createOrder(wallet1, MID, 0);
    expect(res.result).toBeErr(Cl.uint(105));
  });
});
```

- [ ] **Step 5: Run the tests — expect FAIL then PASS**

Run: `cd contracts && npm test -- limit-order-vault`
Expected: contract compiles, create-order tests PASS. If the contract has a syntax error, fix it and re-run.

- [ ] **Step 6: Commit**

```bash
git add contracts/limit-order-vault.clar contracts/mock-stx-sbtc-router.clar contracts/Clarinet.toml.test contracts/tests/limit-order-vault.test.ts
git commit -m "feat(contract): limit-order-vault create-order + mock router"
```

---

## Task 2: `execute-order`

**Files:**
- Modify: `contracts/limit-order-vault.clar`
- Test: `contracts/tests/limit-order-vault.test.ts`

**Interfaces:**
- Consumes: `create-order` (Task 1), `mock-stx-sbtc-router.swap-stx-for-token`.
- Produces: `execute-order(order-id uint, swap-router <dca-swap-trait>, min-amount-out uint) -> (response { net-swapped: uint, protocol-fee: uint } uint)`.

- [ ] **Step 1: Write the failing execute tests**

Append to `contracts/tests/limit-order-vault.test.ts` inside the file:

```typescript
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
    expect(res.result).toBeErr(Cl.uint(999));
  });

  it("cannot execute an already-filled order", () => {
    const id = extractId(createOrder(wallet1));
    expect(executeOrder(id, 0).result.type).toBe("ok");
    const res = executeOrder(id, 0);
    expect(res.result).toBeErr(Cl.uint(102));
  });

  it("is permissionless — a non-owner can execute", () => {
    const id = extractId(createOrder(wallet1));
    const res = executeOrder(id, 0, wallet2);
    expect(res.result.type).toBe("ok");
  });
});
```

- [ ] **Step 2: Run tests to verify they FAIL**

Run: `cd contracts && npm test -- limit-order-vault`
Expected: FAIL — `execute-order` is undefined / call errors.

- [ ] **Step 3: Implement `execute-order`**

In `contracts/limit-order-vault.clar`, add after `create-order` (before the read-onlys):

```clarity
(define-public (execute-order
    (order-id       uint)
    (swap-router    <dca-swap-trait>)
    (min-amount-out uint))
  (let ((o     (unwrap! (map-get? orders order-id) E101))
        (amt   (get amt o))
        (owner (get owner o))
        (pf    (protocol-fee (get amt o)))
        (net   (- (get amt o) (protocol-fee (get amt o)))))
    (asserts! (is-eq (get status o) STATUS-OPEN) E102)
    (as-contract (try! (stx-transfer? pf tx-sender TREASURY)))
    (as-contract (try! (stx-transfer? net tx-sender (contract-of swap-router))))
    (as-contract (try! (contract-call? swap-router swap-stx-for-token net min-amount-out owner)))
    (map-set orders order-id (merge o { status: STATUS-FILLED, fab: stacks-block-height }))
    (map-set open-cnt owner (- (oc-of owner) u1))
    (var-set tvol (+ (var-get tvol) amt))
    (var-set toe  (+ (var-get toe)  u1))
    (print { event: "order-filled", order-id: order-id, owner: owner,
             executor: tx-sender, net-swapped: net, protocol-fee: pf,
             min-out: min-amount-out })
    (ok { net-swapped: net, protocol-fee: pf })))
```

- [ ] **Step 4: Run tests to verify they PASS**

Run: `cd contracts && npm test -- limit-order-vault`
Expected: all execute-order tests PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/limit-order-vault.clar contracts/tests/limit-order-vault.test.ts
git commit -m "feat(contract): limit-order-vault execute-order with min-out guard"
```

---

## Task 3: `cancel-order` + cap + lifecycle

**Files:**
- Modify: `contracts/limit-order-vault.clar`
- Test: `contracts/tests/limit-order-vault.test.ts`

**Interfaces:**
- Produces: `cancel-order(order-id uint) -> (response uint uint)` (returns refunded uSTX).

- [ ] **Step 1: Write the failing cancel + cap tests**

Append to `contracts/tests/limit-order-vault.test.ts`:

```typescript
function cancelOrder(id: number, sender = deployer) {
  return simnet.callPublicFn(VAULT, "cancel-order", [Cl.uint(id)], sender);
}

describe("limit-order-vault: cancel-order", () => {
  it("refunds and decrements open-count", () => {
    const id = extractId(createOrder(wallet1));
    const openBefore = openCount(wallet1);
    const res = cancelOrder(id);
    expect(res.result.type).toBe("ok");
    expect(Cl.prettyPrint(openCount(wallet1))).not.toBe(Cl.prettyPrint(openBefore));
  });

  it("only the owner can cancel", () => {
    const id = extractId(createOrder(wallet1));
    const res = cancelOrder(id, wallet2);
    expect(res.result).toBeErr(Cl.uint(100));
  });

  it("cannot cancel a filled order", () => {
    const id = extractId(createOrder(wallet1));
    executeOrder(id, 0);
    const res = cancelOrder(id);
    expect(res.result).toBeErr(Cl.uint(102));
  });
});

describe("limit-order-vault: open-order cap", () => {
  it("rejects an 11th concurrently-open order then allows one after a fill frees a slot", () => {
    // wallet2 starts clean in this fresh principal's open-cnt
    const u = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
    // open 10
    const ids: number[] = [];
    for (let i = 0; i < 10; i++) ids.push(extractId(createOrder(u)));
    // 11th rejected
    expect(createOrder(u).result).toBeErr(Cl.uint(107));
    // fill one to free a slot
    executeOrder(ids[0], 0);
    // now one more is allowed
    expect(createOrder(u).result.type).toBe("ok");
  });
});
```

- [ ] **Step 2: Run tests to verify they FAIL**

Run: `cd contracts && npm test -- limit-order-vault`
Expected: FAIL — `cancel-order` undefined; the cap test fails if `open-cnt` is not decremented on fill (it is, from Task 2) — the cancel tests drive the RED here.

- [ ] **Step 3: Implement `cancel-order`**

In `contracts/limit-order-vault.clar`, add after `execute-order`:

```clarity
(define-public (cancel-order (order-id uint))
  (let ((o     (unwrap! (map-get? orders order-id) E101))
        (owner (get owner o))
        (amt   (get amt o)))
    (asserts! (is-eq tx-sender owner)            E100)
    (asserts! (is-eq (get status o) STATUS-OPEN) E102)
    (as-contract (try! (stx-transfer? amt tx-sender owner)))
    (map-set orders order-id (merge o { status: STATUS-CANCELLED }))
    (map-set open-cnt owner (- (oc-of owner) u1))
    (print { event: "order-cancelled", order-id: order-id, owner: owner, refunded: amt })
    (ok amt)))
```

- [ ] **Step 4: Run tests to verify they PASS**

Run: `cd contracts && npm test`
Expected: the full `limit-order-vault` suite PASSES and the existing DCA suites remain green.

- [ ] **Step 5: Commit**

```bash
git add contracts/limit-order-vault.clar contracts/tests/limit-order-vault.test.ts
git commit -m "feat(contract): limit-order-vault cancel-order + open-order cap"
```

---

## Task 4: Frontend lib — validation + types + tx wrappers

**Files:**
- Create: `src/lib/limit-orders.ts`
- Test: `src/lib/limit-orders.test.ts`

**Interfaces:**
- Produces:
  - `interface LimitOrder { id: number; owner: string; token: string; amtMicroStx: number; targetUsdMicro: number; status: 0 | 1 | 2; createdAtBlock: number; filledAtBlock: number; }`
  - `MIN_DEPOSIT_USTX = 2_000_000`, `MAX_OPEN_ORDERS = 10`
  - `usdToMicro(n: number): number`, `microToUsd(n: number): number`
  - `validateLimitOrder(input: { depositStx: number; targetUsd: number; openOrderCount: number }): { ok: boolean; errors: string[] }`
  - `createLimitOrder(targetToken, depositMicroStx, targetUsdMicro, onFinish, onCancel?)`, `cancelLimitOrder(orderId, onFinish, onCancel?)` (thin `openContractCall` wrappers).
- Consumes: `@stacks/connect` `openContractCall`, `@stacks/transactions` `uintCV`/`contractPrincipalCV`.

- [ ] **Step 1: Write the failing validation tests**

Create `src/lib/limit-orders.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateLimitOrder, usdToMicro, microToUsd, MIN_DEPOSIT_USTX, MAX_OPEN_ORDERS } from "./limit-orders";

describe("limit-orders validation", () => {
  it("accepts a valid order", () => {
    const r = validateLimitOrder({ depositStx: 5, targetUsd: 60000, openOrderCount: 0 });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects a deposit below the 2 STX minimum", () => {
    const r = validateLimitOrder({ depositStx: 1, targetUsd: 60000, openOrderCount: 0 });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("rejects a non-positive target price", () => {
    const r = validateLimitOrder({ depositStx: 5, targetUsd: 0, openOrderCount: 0 });
    expect(r.ok).toBe(false);
  });

  it("rejects when the open-order cap is reached", () => {
    const r = validateLimitOrder({ depositStx: 5, targetUsd: 60000, openOrderCount: MAX_OPEN_ORDERS });
    expect(r.ok).toBe(false);
  });

  it("round-trips USD <-> micro-USD", () => {
    expect(usdToMicro(60000)).toBe(60_000_000_000);
    expect(microToUsd(60_000_000_000)).toBe(60000);
  });

  it("exposes the 2 STX minimum in uSTX", () => {
    expect(MIN_DEPOSIT_USTX).toBe(2_000_000);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run src/lib/limit-orders.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/limit-orders.ts`**

```typescript
import { openContractCall } from "@stacks/connect";
import { uintCV, contractPrincipalCV } from "@stacks/transactions";

export const MIN_DEPOSIT_USTX = 2_000_000; // 2 STX
export const MAX_OPEN_ORDERS = 10;
const USD_SCALE = 1_000_000;

export const LIMIT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";
export const LIMIT_CONTRACT_NAME = "limit-order-vault";
// sBTC target token (SIP-010). Source = STX.
export const SBTC_TOKEN =
  "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
export const LIMIT_SWAP_ROUTER =
  "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router";

export interface LimitOrder {
  id: number;
  owner: string;
  token: string;
  amtMicroStx: number;
  targetUsdMicro: number;
  status: 0 | 1 | 2; // open | filled | cancelled
  createdAtBlock: number;
  filledAtBlock: number;
}

export const usdToMicro = (n: number) => Math.round(n * USD_SCALE);
export const microToUsd = (n: number) => n / USD_SCALE;

export function validateLimitOrder(input: {
  depositStx: number;
  targetUsd: number;
  openOrderCount: number;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!(input.depositStx >= MIN_DEPOSIT_USTX / 1_000_000)) {
    errors.push("Deposit must be at least 2 STX");
  }
  if (!(input.targetUsd > 0)) {
    errors.push("Target price must be greater than 0");
  }
  if (input.openOrderCount >= MAX_OPEN_ORDERS) {
    errors.push("You have reached the maximum of 10 open orders");
  }
  return { ok: errors.length === 0, errors };
}

export function createLimitOrder(
  targetToken: string,
  depositMicroStx: number,
  targetUsdMicro: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const [tAddr, tName] = targetToken.split(".");
  openContractCall({
    contractAddress: LIMIT_CONTRACT_ADDRESS,
    contractName: LIMIT_CONTRACT_NAME,
    functionName: "create-order",
    functionArgs: [
      contractPrincipalCV(tAddr, tName),
      uintCV(depositMicroStx),
      uintCV(targetUsdMicro),
    ],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function cancelLimitOrder(
  orderId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: LIMIT_CONTRACT_ADDRESS,
    contractName: LIMIT_CONTRACT_NAME,
    functionName: "cancel-order",
    functionArgs: [uintCV(orderId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run src/lib/limit-orders.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/limit-orders.ts src/lib/limit-orders.test.ts
git commit -m "feat(limit): pure validation + tx wrappers for limit orders"
```

---

## Task 5: Server read — fetch + parse open orders

**Files:**
- Create: `src/lib/server/limit-orders-read.ts`
- Test: `src/lib/server/limit-orders-read.test.ts`

**Interfaces:**
- Consumes: `LimitOrder` (Task 4); `@/lib/stacks` read-only helper (use the same `callReadOnly`/`fetchCallReadOnlyFunction` the codebase already uses — see `protocol-positions.ts` for the pattern).
- Produces:
  - `parseOrderTuple(cv: ClarityValue, id: number): LimitOrder | null`
  - `getUserLimitOrders(address: string): Promise<LimitOrder[]>` (returns OPEN orders only).

- [ ] **Step 1: Write the failing parser test**

Create `src/lib/server/limit-orders-read.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";
import { parseOrderTuple } from "./limit-orders-read";

function someOrder(status: number) {
  return Cl.some(
    Cl.tuple({
      owner: Cl.standardPrincipal("SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV"),
      token: Cl.contractPrincipal("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", "sbtc-token"),
      amt: Cl.uint(5_000_000),
      "target-usd": Cl.uint(60_000_000_000),
      status: Cl.uint(status),
      cat: Cl.uint(1000),
      fab: Cl.uint(0),
    })
  );
}

describe("parseOrderTuple", () => {
  it("decodes an open order tuple", () => {
    const o = parseOrderTuple(someOrder(0), 3);
    expect(o).not.toBeNull();
    expect(o!.id).toBe(3);
    expect(o!.amtMicroStx).toBe(5_000_000);
    expect(o!.targetUsdMicro).toBe(60_000_000_000);
    expect(o!.status).toBe(0);
  });

  it("returns null for a none (missing) order", () => {
    expect(parseOrderTuple(Cl.none(), 9)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run src/lib/server/limit-orders-read.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/server/limit-orders-read.ts`**

Mirror the read-only call style already used in `src/lib/protocol-positions.ts` (it imports `serializeCV`/`hexToCV`/`ClarityType` and calls the Hiro `call-read-only` API). Use that same helper here.

```typescript
import { ClarityType, type ClarityValue, cvToValue } from "@stacks/transactions";
import { callReadOnly } from "@/lib/stacks"; // existing read-only helper (see protocol-positions.ts)
import { LIMIT_CONTRACT_ADDRESS, LIMIT_CONTRACT_NAME, type LimitOrder } from "@/lib/limit-orders";

export function parseOrderTuple(cv: ClarityValue, id: number): LimitOrder | null {
  if (cv.type !== ClarityType.OptionalSome) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = cvToValue(cv) as any; // { value: { owner, token, amt, 'target-usd', status, cat, fab } }
  const t = v.value ?? v;
  return {
    id,
    owner: String(t.owner.value ?? t.owner),
    token: String(t.token.value ?? t.token),
    amtMicroStx: Number(t.amt.value ?? t.amt),
    targetUsdMicro: Number(t["target-usd"].value ?? t["target-usd"]),
    status: Number(t.status.value ?? t.status) as 0 | 1 | 2,
    createdAtBlock: Number(t.cat.value ?? t.cat),
    filledAtBlock: Number(t.fab.value ?? t.fab),
  };
}

export async function getUserLimitOrders(address: string): Promise<LimitOrder[]> {
  // 1) read the user's order ids
  const idsCv = await callReadOnly(
    LIMIT_CONTRACT_ADDRESS, LIMIT_CONTRACT_NAME, "get-user-orders", [address /* principalCV */], address
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids: number[] = (cvToValue(idsCv) as any[]).map((x) => Number(x.value ?? x));
  // 2) fetch each order, keep OPEN (status 0)
  const orders = await Promise.all(
    ids.map(async (id) => {
      const cv = await callReadOnly(
        LIMIT_CONTRACT_ADDRESS, LIMIT_CONTRACT_NAME, "get-order", [id /* uintCV */], address
      );
      return parseOrderTuple(cv, id);
    })
  );
  return orders.filter((o): o is LimitOrder => o !== null && o.status === 0);
}
```

> Implementer note: match `callReadOnly`'s real signature in `@/lib/stacks` (argument CV wrapping, sender). The two tests above only cover `parseOrderTuple`, which is pure; `getUserLimitOrders` is build- and e2e-verified.

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run src/lib/server/limit-orders-read.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/limit-orders-read.ts src/lib/server/limit-orders-read.test.ts
git commit -m "feat(limit): server read + tuple parser for open orders"
```

---

## Task 6: Wire orders into the portfolio snapshot

**Files:**
- Modify: `src/lib/server/portfolio-snapshot.ts:34-45` (interface) and `:71-114` (assembly)

**Interfaces:**
- Consumes: `getUserLimitOrders` (Task 5).
- Produces: `PortfolioSnapshot.limitOrders: LimitOrder[] | null`.

- [ ] **Step 1: Add the field + fetch**

In `src/lib/server/portfolio-snapshot.ts`:
- Add import: `import { getUserLimitOrders } from "./limit-orders-read"; import type { LimitOrder } from "@/lib/limit-orders";`
- Add `limitOrders: LimitOrder[] | null;` to the `PortfolioSnapshot` interface.
- Add `safe(getUserLimitOrders(address))` to the `Promise.all` array and destructure `limitOrders`, then include `limitOrders` in the returned object. (Keep array/destructure/return in the same order — append at the end so existing positions are untouched.)

- [ ] **Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: build succeeds; no type errors from the new field.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/portfolio-snapshot.ts
git commit -m "feat(limit): include open limit orders in portfolio snapshot"
```

---

## Task 7: `useLimitOrders` snapshot selector

**Files:**
- Modify: `src/hooks/usePortfolioSnapshot.ts`

**Interfaces:**
- Produces: `useLimitOrders(): { orders: LimitOrder[]; openCount: number; isLoading: boolean }`.

- [ ] **Step 1: Add the selector hook**

In `src/hooks/usePortfolioSnapshot.ts`, follow the existing selector pattern (e.g. the DCA-plans selector) and add:

```typescript
import type { LimitOrder } from "@/lib/limit-orders";

export function useLimitOrders() {
  const { data, isLoading } = usePortfolioSnapshot(); // reuse the existing base hook
  const orders: LimitOrder[] = data?.limitOrders ?? [];
  return { orders, openCount: orders.length, isLoading };
}
```

(Use the same base-hook name/shape the other selectors in this file use — match them exactly.)

- [ ] **Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePortfolioSnapshot.ts
git commit -m "feat(limit): useLimitOrders snapshot selector"
```

---

## Task 8: `LimitOrderCard` component

**Files:**
- Create: `src/components/limit/LimitOrderCard.tsx`

**Interfaces:**
- Consumes: `LimitOrder`, `microToUsd`, `cancelLimitOrder` (Task 4); `trackTx` from `@/lib/tx-tracker`; `useWalletStore` from `@/store/walletStore`; `useNotificationStore`.
- Produces: `export default function LimitOrderCard({ order, currentSbtcUsd }: { order: LimitOrder; currentSbtcUsd: number | null })`.

- [ ] **Step 1: Implement the card**

```tsx
"use client";
import { useTranslations } from "next-intl";
import { microToUsd, cancelLimitOrder, type LimitOrder } from "@/lib/limit-orders";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { trackTx } from "@/lib/tx-tracker";
import { track } from "@/lib/telemetry";
import { X } from "lucide-react";

export default function LimitOrderCard({
  order,
  currentSbtcUsd,
}: {
  order: LimitOrder;
  currentSbtcUsd: number | null;
}) {
  const t = useTranslations("limit");
  const { stxAddress } = useWalletStore();
  const { addNotification } = useNotificationStore();

  const targetUsd = microToUsd(order.targetUsdMicro);
  const depositStx = order.amtMicroStx / 1_000_000;
  const distancePct =
    currentSbtcUsd && currentSbtcUsd > 0
      ? ((currentSbtcUsd - targetUsd) / currentSbtcUsd) * 100
      : null;

  function onCancel() {
    cancelLimitOrder(order.id, (data) => {
      trackTx({
        txId: data.txId,
        label: t("cancelLabel", { id: order.id }),
        category: "limit-order",
        addNotification,
        address: stxAddress ?? undefined,
      });
      track("order-cancelled", { orderId: order.id });
    });
  }

  return (
    <div className="glass-card rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          {t("buyTitle", { stx: depositStx })}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {t("targetLine", { usd: targetUsd.toLocaleString() })}
          {distancePct !== null && ` · ${distancePct > 0 ? "+" : ""}${distancePct.toFixed(1)}%`}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="p-2 rounded-lg"
        style={{ color: "var(--text-muted)" }}
        aria-label={t("cancelAria")}
      >
        <X size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: succeeds (i18n keys are added in Task 12; build does not fail on missing runtime keys).

- [ ] **Step 3: Commit**

```bash
git add src/components/limit/LimitOrderCard.tsx
git commit -m "feat(limit): LimitOrderCard with cancel + distance-to-target"
```

---

## Task 9: `MyLimitOrders` list

**Files:**
- Create: `src/components/limit/MyLimitOrders.tsx`

**Interfaces:**
- Consumes: `useLimitOrders` (Task 7), `LimitOrderCard` (Task 8); sBTC USD price (reuse `useSwapPrices` from `@/hooks/useMarketData`, as `SwapWidget` does).
- Produces: `export default function MyLimitOrders()`.

- [ ] **Step 1: Implement the list**

```tsx
"use client";
import { useTranslations } from "next-intl";
import { useLimitOrders } from "@/hooks/usePortfolioSnapshot";
import { useSwapPrices } from "@/hooks/useMarketData";
import LimitOrderCard from "./LimitOrderCard";

export default function MyLimitOrders() {
  const t = useTranslations("limit");
  const { orders, isLoading } = useLimitOrders();
  const prices = useSwapPrices();
  const sbtcUsd = prices?.sbtc ?? null; // confirm the field name in useSwapPrices

  if (isLoading) return null;
  if (orders.length === 0) {
    return (
      <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
        {t("empty")}
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {orders.map((o) => (
        <LimitOrderCard key={o.id} order={o} currentSbtcUsd={sbtcUsd} />
      ))}
    </div>
  );
}
```

> Implementer note: confirm the sBTC USD field on `useSwapPrices()` (open `SwapWidget.tsx`); adjust `prices?.sbtc` to the real key.

- [ ] **Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/limit/MyLimitOrders.tsx
git commit -m "feat(limit): MyLimitOrders list with live distance"
```

---

## Task 10: `CreateLimitOrderForm`

**Files:**
- Create: `src/components/limit/CreateLimitOrderForm.tsx`

**Interfaces:**
- Consumes: `validateLimitOrder`, `usdToMicro`, `createLimitOrder`, `SBTC_TOKEN` (Task 4); `useLimitOrders` (open count); `useWalletStore`; `useNotificationStore`; `trackTx`; `track`.
- Produces: `export default function CreateLimitOrderForm()`.

- [ ] **Step 1: Implement the form**

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  validateLimitOrder, usdToMicro, createLimitOrder, SBTC_TOKEN,
} from "@/lib/limit-orders";
import { useLimitOrders } from "@/hooks/usePortfolioSnapshot";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { trackTx } from "@/lib/tx-tracker";
import { track } from "@/lib/telemetry";

export default function CreateLimitOrderForm() {
  const t = useTranslations("limit");
  const { stxAddress, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const { openCount } = useLimitOrders();
  const [depositStx, setDepositStx] = useState("");
  const [targetUsd, setTargetUsd] = useState("");

  const deposit = parseFloat(depositStx) || 0;
  const target = parseFloat(targetUsd) || 0;
  const { ok, errors } = validateLimitOrder({ depositStx: deposit, targetUsd: target, openOrderCount: openCount });

  function onSubmit() {
    if (!ok || !isConnected) return;
    createLimitOrder(
      SBTC_TOKEN,
      Math.round(deposit * 1_000_000),
      usdToMicro(target),
      (data) => {
        trackTx({
          txId: data.txId,
          label: t("createLabel"),
          category: "limit-order",
          addNotification,
          address: stxAddress ?? undefined,
        });
        track("order-created", { depositStx: deposit, targetUsd: target });
        setDepositStx("");
        setTargetUsd("");
      }
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs" style={{ color: "var(--text-secondary)" }}>
        {t("depositLabel")}
        <input
          inputMode="decimal" value={depositStx} onChange={(e) => setDepositStx(e.target.value)}
          placeholder="2.0"
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
        />
      </label>
      <label className="block text-xs" style={{ color: "var(--text-secondary)" }}>
        {t("targetLabel")}
        <input
          inputMode="decimal" value={targetUsd} onChange={(e) => setTargetUsd(e.target.value)}
          placeholder="60000"
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
        />
      </label>
      {!ok && depositStx !== "" && (
        <p className="text-xs" style={{ color: "var(--negative)" }}>{errors[0]}</p>
      )}
      <button
        onClick={onSubmit}
        disabled={!ok || !isConnected}
        className="w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        {isConnected ? t("submit") : t("connectFirst")}
      </button>
    </div>
  );
}
```

> Implementer note: confirm `--accent-contrast` / `--negative` exist in `globals.css`; if not, use the nearest existing tokens (e.g. the ones `SwapWidget`'s primary button uses).

- [ ] **Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/limit/CreateLimitOrderForm.tsx
git commit -m "feat(limit): CreateLimitOrderForm with live validation"
```

---

## Task 11: Mount the Limit Orders section on `/trade`

**Files:**
- Modify: `src/app/[locale]/trade/page.tsx`

- [ ] **Step 1: Add the card section**

In `src/app/[locale]/trade/page.tsx`:
- Add imports:

```tsx
import { Suspense } from "react"; // already imported
import CreateLimitOrderForm from "@/components/limit/CreateLimitOrderForm";
import MyLimitOrders from "@/components/limit/MyLimitOrders";
import { Target } from "lucide-react";
```

- Insert a new `MotionCard` immediately after the Swap Widget card (after line 43, before the Recent Swaps card):

```tsx
{/* Limit Orders */}
<MotionCard className="glass-card rounded-2xl p-6 shadow-sm">
  <div className="flex items-center gap-2.5 mb-5">
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center"
      style={{ backgroundColor: 'var(--accent-dim)' }}
    >
      <Target size={15} style={{ color: 'var(--accent)' }} />
    </div>
    <div>
      <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t("limitTitle")}</h2>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t("limitDesc")}</p>
    </div>
  </div>
  <Suspense fallback={null}>
    <CreateLimitOrderForm />
    <div className="mt-4">
      <MyLimitOrders />
    </div>
  </Suspense>
</MotionCard>
```

Note: `t("limitTitle")`/`t("limitDesc")` use the existing `trade` translations object `t`; add those two keys in Task 12 (the rest of the limit copy lives in the `limit` namespace used by the client components).

- [ ] **Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/trade/page.tsx
git commit -m "feat(limit): mount limit-order section on /trade"
```

---

## Task 12: i18n — `limit` namespace (en/vi/zh/ja)

**Files:**
- Modify: `messages/en.json`, `messages/vi.json`, `messages/zh.json`, `messages/ja.json`

- [ ] **Step 1: Add keys to all four files**

Add a top-level `"limit"` object to each, plus `limitTitle`/`limitDesc` inside the existing `"trade"` object. English (`messages/en.json`):

```json
"limit": {
  "depositLabel": "Deposit (STX)",
  "targetLabel": "Buy when sBTC ≤ (USD)",
  "submit": "Create limit order",
  "connectFirst": "Connect wallet",
  "empty": "No open limit orders",
  "buyTitle": "Buy with {stx} STX",
  "targetLine": "Target ${usd}",
  "createLabel": "Create limit order",
  "cancelLabel": "Cancel order #{id}",
  "cancelAria": "Cancel order"
}
```

And inside `"trade"`: `"limitTitle": "Limit Orders"`, `"limitDesc": "Auto-buy sBTC when the price drops to your target."`

Vietnamese (`messages/vi.json`):

```json
"limit": {
  "depositLabel": "Nạp (STX)",
  "targetLabel": "Mua khi sBTC ≤ (USD)",
  "submit": "Tạo lệnh chờ",
  "connectFirst": "Kết nối ví",
  "empty": "Chưa có lệnh chờ nào",
  "buyTitle": "Mua bằng {stx} STX",
  "targetLine": "Mục tiêu ${usd}",
  "createLabel": "Tạo lệnh chờ",
  "cancelLabel": "Huỷ lệnh #{id}",
  "cancelAria": "Huỷ lệnh"
}
```

Plus `"trade"`: `"limitTitle": "Lệnh chờ"`, `"limitDesc": "Tự động mua sBTC khi giá giảm về mục tiêu của bạn."`

Chinese (`messages/zh.json`):

```json
"limit": {
  "depositLabel": "存入 (STX)",
  "targetLabel": "当 sBTC ≤ (USD) 时买入",
  "submit": "创建限价单",
  "connectFirst": "连接钱包",
  "empty": "暂无未成交限价单",
  "buyTitle": "用 {stx} STX 买入",
  "targetLine": "目标 ${usd}",
  "createLabel": "创建限价单",
  "cancelLabel": "取消订单 #{id}",
  "cancelAria": "取消订单"
}
```

Plus `"trade"`: `"limitTitle": "限价单"`, `"limitDesc": "当价格跌至你的目标时自动买入 sBTC。"`

Japanese (`messages/ja.json`):

```json
"limit": {
  "depositLabel": "預入 (STX)",
  "targetLabel": "sBTC が (USD) 以下で買う",
  "submit": "指値注文を作成",
  "connectFirst": "ウォレット接続",
  "empty": "未約定の指値注文はありません",
  "buyTitle": "{stx} STX で買う",
  "targetLine": "目標 ${usd}",
  "createLabel": "指値注文を作成",
  "cancelLabel": "注文 #{id} をキャンセル",
  "cancelAria": "注文をキャンセル"
}
```

Plus `"trade"`: `"limitTitle": "指値注文"`, `"limitDesc": "価格が目標まで下がったら sBTC を自動で買います。"`

- [ ] **Step 2: Run the i18n parity test + build**

Run: `npm test -- i18n` then `npm run build`
Expected: parity test PASSES (all four locales have identical key sets); build succeeds.

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/vi.json messages/zh.json messages/ja.json
git commit -m "i18n(limit): add limit-order namespace (en/vi/zh/ja)"
```

---

## Task 13: Keeper config — contract id + slippage

**Files:**
- Modify: `keeper-bot/src/config.ts:16-80`

**Interfaces:**
- Produces: `KeeperConfig.limitOrderVaultContract: string`, `KeeperConfig.limitSlippageBps: number`.

- [ ] **Step 1: Add config fields**

In `keeper-bot/src/config.ts`, add to the config interface:

```typescript
limitOrderVaultContract: string; // "SP2CMK....limit-order-vault"
limitSlippageBps:        number; // default 100 = 1%
```

And in the loader, alongside the existing `optional(...)` vault entries:

```typescript
limitOrderVaultContract: optional(
  "LIMIT_ORDER_VAULT_CONTRACT",
  `${contractAddress}.limit-order-vault`
),
limitSlippageBps: Number(process.env.LIMIT_SLIPPAGE_BPS ?? "100"),
```

(Use the same `contractAddress` base the other vault defaults use in this file.)

- [ ] **Step 2: Build to verify**

Run: `cd keeper-bot && npm run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add keeper-bot/src/config.ts
git commit -m "feat(keeper): config for limit-order vault + slippage"
```

---

## Task 14: Keeper — discover open limit orders

**Files:**
- Modify: `keeper-bot/src/stacks-client.ts`
- Test: `keeper-bot/src/stacks-client.test.ts` (extend existing)

**Interfaces:**
- Produces: `getExecutableLimitOrders(): Promise<{ orderId: number; owner: string; amt: number; targetUsdMicro: number }[]>` — reads `get-stats().oc`, loops `get-order(id)` from 1..oc, keeps `status === 0`.
- Consumes: existing `hiroBreaker.exec` + read-only call helper in this file.

- [ ] **Step 1: Write the failing test**

In `keeper-bot/src/stacks-client.test.ts`, add a test that mocks the read-only responses (follow the mocking style already in this file — mock the breaker/RPC) so that given `oc = 2`, one open + one filled order, `getExecutableLimitOrders()` returns only the open one:

```typescript
it("returns only OPEN limit orders up to the counter", async () => {
  // arrange: mock get-stats -> oc=2; get-order(1)->open, get-order(2)->filled
  // (use the same RPC/breaker mock pattern as the DCA tests above)
  const out = await client.getExecutableLimitOrders();
  expect(out.map((o) => o.orderId)).toEqual([1]);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd keeper-bot && npx vitest run src/stacks-client.test.ts`
Expected: FAIL — method undefined.

- [ ] **Step 3: Implement `getExecutableLimitOrders`**

Add to the client class, mirroring `getExecutablePlanIds`:

```typescript
async getExecutableLimitOrders(): Promise<
  { orderId: number; owner: string; amt: number; targetUsdMicro: number }[]
> {
  const contract = this.config.limitOrderVaultContract;
  const oc = await this.hiroBreaker.exec(() => this.readOc(contract)); // reads get-stats().oc
  const out: { orderId: number; owner: string; amt: number; targetUsdMicro: number }[] = [];
  for (let id = 1; id <= oc; id++) {
    const order = await this.hiroBreaker.exec(() => this.readOrder(contract, id));
    if (order && order.status === 0) out.push({ orderId: id, ...order });
  }
  return out;
}
```

Implement the private `readOc` / `readOrder` helpers using the same read-only call + breaker plumbing the file already uses for DCA (`canExecute`, `getStats`). Decode the `get-order` tuple to `{ owner, amt, targetUsdMicro, status }`.

- [ ] **Step 4: Run to verify PASS**

Run: `cd keeper-bot && npx vitest run src/stacks-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add keeper-bot/src/stacks-client.ts keeper-bot/src/stacks-client.test.ts
git commit -m "feat(keeper): discover open limit orders from the vault"
```

---

## Task 15: Keeper — trigger eval + minOut (`limit-push.ts`)

**Files:**
- Create: `keeper-bot/src/limit-push.ts`
- Test: `keeper-bot/src/limit-push.test.ts`

**Interfaces:**
- Produces:
  - `shouldFill(order: { targetUsdMicro: number }, sbtcUsd: number): boolean` — `sbtcUsd <= targetUsdMicro/1e6`.
  - `computeMinOut(netUstx: number, quoteSbtcPerUstx: number, slippageBps: number): number` — `floor(netUstx * quoteSbtcPerUstx * (1 - slippageBps/10000))`.
- Consumes: `fetchPrices` (reuse from `price-push.ts` — export it if not already), pool quote helper, `getExecutableLimitOrders` (Task 14).

- [ ] **Step 1: Write the failing tests**

Create `keeper-bot/src/limit-push.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { shouldFill, computeMinOut } from "./limit-push";

describe("limit-push: shouldFill", () => {
  it("fills when price is at or below target", () => {
    expect(shouldFill({ targetUsdMicro: 60_000_000_000 }, 59_000)).toBe(true);
    expect(shouldFill({ targetUsdMicro: 60_000_000_000 }, 60_000)).toBe(true);
  });
  it("skips when price is above target", () => {
    expect(shouldFill({ targetUsdMicro: 60_000_000_000 }, 61_000)).toBe(false);
  });
});

describe("limit-push: computeMinOut", () => {
  it("applies slippage to the quote", () => {
    // 1,000,000 uSTX * 0.000004 sBTC/uSTX = 4 sBTC units, minus 1% = 3.96 -> floor 3
    expect(computeMinOut(1_000_000, 0.000004, 100)).toBe(3);
  });
  it("returns 0 for a zero quote", () => {
    expect(computeMinOut(1_000_000, 0, 100)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd keeper-bot && npx vitest run src/limit-push.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `limit-push.ts`**

```typescript
// keeper-bot/src/limit-push.ts
// Pure trigger math + the run-step that fills eligible limit orders.

export function shouldFill(order: { targetUsdMicro: number }, sbtcUsd: number): boolean {
  return sbtcUsd <= order.targetUsdMicro / 1_000_000;
}

export function computeMinOut(
  netUstx: number,
  quoteSbtcPerUstx: number,
  slippageBps: number
): number {
  if (!(quoteSbtcPerUstx > 0)) return 0;
  const expected = netUstx * quoteSbtcPerUstx;
  return Math.floor(expected * (1 - slippageBps / 10_000));
}
```

(The run-step that ties `getExecutableLimitOrders` + `fetchPrices` + a live pool quote + broadcast is wired in Task 16; keep this module's exports pure so they stay unit-testable.)

- [ ] **Step 4: Run to verify PASS**

Run: `cd keeper-bot && npx vitest run src/limit-push.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add keeper-bot/src/limit-push.ts keeper-bot/src/limit-push.test.ts
git commit -m "feat(keeper): limit-order trigger eval + minOut math"
```

---

## Task 16: Keeper — wire execution into `runOnce`

**Files:**
- Modify: `keeper-bot/src/index.ts:40-130` (`runOnce`)
- Modify: `keeper-bot/src/limit-push.ts` (add `runLimitOrders` orchestration)

**Interfaces:**
- Consumes: `getExecutableLimitOrders` (Task 14), `shouldFill`/`computeMinOut` (Task 15), the existing `fetchPrices`, the pool-quote helper used for STX→sBTC, and the existing broadcast/`recordBatch`/push helpers.
- Produces: `runLimitOrders(deps): Promise<{ filled: number }>`.

- [ ] **Step 1: Implement the orchestration in `limit-push.ts`**

Add `runLimitOrders` that: (1) `getExecutableLimitOrders()`; (2) `fetchPrices(['blockstack' /* STX */, ... sBTC gecko id])` → sBTC USD; bail safely if null (return `{ filled: 0 }`, matching `price-push`'s null guard); (3) for each order where `shouldFill`, quote STX→sBTC for `net = amt - 0.3% fee`, `computeMinOut(net, quote, config.limitSlippageBps)`, build + broadcast an `execute-order(orderId, router, minOut)` tx (one tx per order), record `{ txid, planIds: [orderId], status }` to `keeper:recent-batches`, and send the fill web-push + invalidate `portfolio:<owner>`. Reuse the existing broadcaster, recorder, and push helpers — do not reimplement them.

- [ ] **Step 2: Call it from `runOnce`**

In `keeper-bot/src/index.ts`, after the DCA execution block and before the heartbeat `markRun(...)`, add:

```typescript
const limit = await runLimitOrders({ client, config, /* broadcaster, push, redis deps */ })
  .catch((err) => { log.error("limit-order run failed", { msg: String(err) }); return { filled: 0 }; });
log.info("limit orders processed", { filled: limit.filled });
```

Keep it inside the same run-lock and after `reconcileRecentBatches` (so prior limit fills reconcile too). The circuit breaker and heartbeat are unchanged.

- [ ] **Step 3: Build + run keeper tests**

Run: `cd keeper-bot && npm run build && npx vitest run`
Expected: compiles; all keeper tests pass.

- [ ] **Step 4: Commit**

```bash
git add keeper-bot/src/index.ts keeper-bot/src/limit-push.ts
git commit -m "feat(keeper): execute eligible limit orders in runOnce"
```

---

## Task 17: E2E smoke

**Files:**
- Create: `e2e/limit-orders.spec.ts`

**Interfaces:**
- Consumes: the mock wallet fixture in `e2e/fixtures/test-utils.ts` (follow `e2e/dca.spec.ts`).

- [ ] **Step 1: Write the spec**

Create `e2e/limit-orders.spec.ts` mirroring `e2e/dca.spec.ts`:

```typescript
import { test, expect } from "./fixtures/test-utils";

test.describe("Limit Orders", () => {
  test("renders the limit-order section on /trade", async ({ page }) => {
    await page.goto("/trade");
    await expect(page.getByText(/Limit Orders/i)).toBeVisible();
  });

  test("create form validates and is reachable with a mock wallet", async ({ page, connectWallet }) => {
    await page.goto("/trade");
    await connectWallet(); // use the fixture's helper as dca.spec does
    const deposit = page.getByPlaceholder("2.0");
    await deposit.fill("5");
    await page.getByPlaceholder("60000").fill("60000");
    await expect(page.getByRole("button", { name: /Create limit order/i })).toBeEnabled();
  });
});
```

> Implementer note: match the fixture's wallet-connect helper name/usage to `e2e/dca.spec.ts`. Clear stale test-profile localStorage if needed (memory: browser-verify gotchas).

- [ ] **Step 2: Run the spec**

Run: `npx playwright test e2e/limit-orders.spec.ts --project=chromium`
Expected: PASS. Then `npm run test:e2e` to confirm the baseline (~84 desktop / ~78 mobile) is unbroken.

- [ ] **Step 3: Commit**

```bash
git add e2e/limit-orders.spec.ts
git commit -m "test(e2e): smoke the limit-order section + create flow"
```

---

## Task 18: Deploy + env (ops)

**Files:**
- Modify: `contracts/Clarinet.toml` (register `limit-order-vault` for deploy), `contracts/deployments/*`
- Modify: `.env.local`, keeper `.env`, Vercel env

- [ ] **Step 1: Register for deploy + run check**

Add `[contracts.limit-order-vault]` to `contracts/Clarinet.toml` (path `limit-order-vault.clar`, matching clarity_version/epoch of the other live contracts). Run `cd contracts && clarinet check` (the 3 known unresolved-contract errors are expected — memory: clarinet check state).

- [ ] **Step 2: Deploy to mainnet**

Generate + apply the deployment plan for `limit-order-vault` to mainnet (same flow used for the existing vaults). Record the deployment under `contracts/deployments/`.

- [ ] **Step 3: Set env vars**

- Frontend: confirm `NEXT_PUBLIC_CONTRACT_ADDRESS` already points at `SP2CMK69...` (the lib derives the contract id from it).
- Keeper `.env` + Vercel: set `LIMIT_ORDER_VAULT_CONTRACT=SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.limit-order-vault` and optionally `LIMIT_SLIPPAGE_BPS=100`.

- [ ] **Step 4: Verify on one small real order**

Create a 2 STX order with a target just above the current price so the keeper fills it on the next run; confirm the fill tx, the sBTC arrival, and the push notification. Then verify the portfolio snapshot drops the (now filled) order.

- [ ] **Step 5: Commit**

```bash
git add contracts/Clarinet.toml contracts/deployments
git commit -m "chore(deploy): register + deploy limit-order-vault to mainnet"
```

---

## Self-Review

**Spec coverage:**
- Contract (state, create/execute/cancel, open-count cap, fee, minOut guard, read-onlys) → Tasks 1–3. ✓
- `open-count` improvement over DCA's lifetime cap → Task 1 (`open-cnt`) + Task 3 lifecycle test. ✓
- Keeper discovery + USD trigger + minOut + individual execution + reconcile/push → Tasks 13–16. ✓
- FE form/list/card + `/trade` mount → Tasks 8–11. ✓
- Snapshot read pattern (no standalone SWR) → Tasks 5–7. ✓
- i18n en/vi/zh/ja parity → Task 12. ✓
- Tests: contract / lib / keeper / e2e → Tasks 1–3, 4–5, 14–15, 17. ✓
- Out of scope (USDCx→sBTC, take-profit/stop-loss, batch contract) → not planned. ✓

**Placeholder scan:** No "TBD/TODO". Three "implementer note" callouts (read-only helper signature, `useSwapPrices` field, CSS token names, fixture helper) point at exact files to confirm a name — not deferred work. Acceptable.

**Type consistency:** `LimitOrder` fields (`amtMicroStx`, `targetUsdMicro`, `status 0|1|2`) are consistent across `limit-orders.ts`, `limit-orders-read.ts`, the snapshot, and the hook. Contract error codes (`E102` not-open, `E107` cap, `E109` deposit, `E100` auth, `u999` mock minOut revert) match between contract and tests. `execute-order` return `{ net-swapped, protocol-fee }` matches Task 2's test assertions.
