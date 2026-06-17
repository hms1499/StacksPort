# Limit Order Vault — Design

**Date:** 2026-06-17
**Status:** Approved (brainstorm), pending implementation plan
**Scope:** v1 = STX→sBTC limit buy only. USDCx→sBTC is explicitly out of scope (fast-follow).

## Summary

A non-custodial **conditional limit-buy** feature: a user deposits STX into a new
`limit-order-vault` contract with a target USD price for sBTC. The keeper bot watches
the sBTC USD price and, when `current ≤ target`, executes a one-shot STX→sBTC swap that
sends sBTC directly to the user. Orders are good-til-cancelled (GTC); the user can cancel
any open order for a full refund.

This mirrors the existing DCA architecture (vault-locked funds, permissionless keeper
execution, `min-amount-out` slippage guard) and reuses the keeper's price feed, broadcast,
reconcile, and notification infrastructure.

## Decisions (from brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| Execution model | **Vault-locked** (like DCA) | Trustless, non-custodial, matches existing pattern |
| Order types | **Limit buy only** (buy when price ≤ X) | YAGNI; take-profit/stop-loss/trailing deferred |
| Pair (v1) | **STX→sBTC** | Route + on-chain router already live & tested |
| Pair (deferred) | USDCx→sBTC | No `usdcx→sbtc` router exists on-chain — needs a new Clarity router deployed first |
| Trigger price | **sBTC USD price** (keeper-evaluated) | Most intuitive UX; `min-amount-out` remains the on-chain trust guard |
| Lifecycle | **One-shot + GTC + cancel anytime** | Simplest correct limit-order model |
| Per-user limit | **Separate cap (10 open orders)**, min deposit 2 STX | Isolated from DCA's 10-plan cap; no cross-contract coupling |

### On-chain router verification (2026-06-17)

Verified the deployed routers expose only one direction each:

- `bitflow-sbtc-swap-router` → `swap-stx-for-token` (STX→sBTC) ✅ — used by v1
- `bitflow-usdcx-swap-router` → `swap-sbtc-for-token` (sBTC→USDCx)
- `bitflow-usdcx-from-stx-router` → `swap-stx-for-token` (STX→USDCx)

There is **no** `usdcx→sbtc` (nor `usdcx→stx`) router. The pools exist
(USDCx→aeUSDC→STX→sBTC) but executing that reverse 3-hop needs a **new router contract
deployed to mainnet** plus a new characterization test and a USDCx source-token
post-condition branch. Hence USDCx→sBTC is out of scope for v1.

## Architecture (Approach A — standalone contract)

A new standalone `limit-order-vault.clar`, modeled on `dca-vault.clar` minus the interval
logic. Rejected alternatives: extending `dca-vault-v2` (regression risk to live DCA),
and a generic "automation vault" abstraction (over-engineering / YAGNI).

The trigger condition lives entirely in the keeper (USD price). The contract cannot read
price; its only on-chain guard is the `min-amount-out` the keeper passes at execution time
(computed from the live pool quote minus slippage tolerance). This is the same keeper trust
model already used by DCA.

## Component 1 — Smart contract: `contracts/limit-order-vault.clar`

### State

```clarity
(define-data-var oc   uint u0)   ;; order counter
(define-data-var tvol uint u0)   ;; total uSTX filled
(define-data-var toe  uint u0)   ;; total orders executed

(define-map orders uint {
  owner:      principal,
  token:      principal,  ;; target token (sBTC) contract
  amt:        uint,       ;; uSTX deposit — swapped in FULL, one-shot
  target-usd: uint,       ;; target price USD * 1e6 (micro-USD) — stored for audit/UI, NOT enforced on-chain
  status:     uint,       ;; 0 open · 1 filled · 2 cancelled
  cat:        uint,       ;; created-at block
  fab:        uint        ;; filled-at block (0 = not yet)
})

(define-map uids principal (list 10 uint))   ;; append-only; enumeration only (FE filters by status)
(define-map open-count principal uint)        ;; cap = number of OPEN orders (inc on create, dec on fill/cancel)
```

**Improvement over DCA:** `dca-vault` caps via the append-only `uids` list, so each order
consumes a slot for the lifetime of the account. For one-shot orders that is too tight, so
`open-count` is tracked separately and decremented on fill/cancel; the cap (`MPPU = 10`)
applies to concurrently-open orders. `uids` stays append-only purely for enumeration.

### Constants

- `MID` = 2 STX (`u2000000`) — min initial deposit (mirrors DCA)
- `MPPU` = `u10` — max open orders per user
- `PFBPS` = `u30`, `BPSB` = `u10000` — 0.3% protocol fee (mirrors DCA)
- `TREASURY` — same treasury principal as DCA
- Error codes in DCA style (`E100` not-owner, `E101` no-order, `E102` bad-status, `E103` insufficient, `E107` cap-reached, `E109` below-min)

### Public functions

- **`create-order(target-token principal, deposit-amount uint, target-usd uint)`**
  - asserts `deposit-amount >= MID`, `(default-to u0 (open-count tx-sender)) < MPPU`
  - `stx-transfer?` deposit → contract
  - writes order `status = u0` (open), `cat = stacks-block-height`, `fab = u0`
  - `oc + 1`; `open-count + 1`; `add-uid`
  - `print { event: "order-created", order-id, owner, token, amt, target-usd }`
- **`execute-order(order-id uint, swap-router <dca-swap-trait>, min-amount-out uint)`**
  - **permissionless** (safe: `min-amount-out` guards price, tokens go straight to owner)
  - asserts `status == u0`
  - fee = `(/ (* amt PFBPS) BPSB)`; `net = amt - fee`
  - `as-contract` transfer fee → `TREASURY`, `net` → `(contract-of swap-router)`
  - `as-contract (contract-call? swap-router swap-stx-for-token net min-amount-out owner)`
  - set `status = u1`, `fab = stacks-block-height`; `open-count - 1`; `toe + 1`; `tvol + amt`
  - `print { event: "order-filled", order-id, owner, executor, net-swapped, protocol-fee, min-out }`
- **`cancel-order(order-id uint)`**
  - owner-only, asserts `status == u0`
  - refund full `amt` → owner; set `status = u2`; `open-count - 1`
  - `print { event: "order-cancelled", order-id, owner, refunded }`

No `deposit`, `pause`, or `resume` (one-shot GTC → YAGNI).

### Read-only

- `get-order(order-id)` → optional order tuple
- `get-user-orders(user)` → `(list 10 uint)` (FE filters by status)
- `get-stats()` → `{ oc, tvol, toe }`

### Trait

Reuses the existing `dca-swap-trait` (`swap-stx-for-token`) and the live
`bitflow-sbtc-swap-router`. No new router for v1.

## Component 2 — Keeper integration

No new batch contract for v1.

- **Discovery (`stacks-client.ts`):** add `getExecutableLimitOrdersForAllVaults()` parallel
  to `getExecutablePlansForAllVaults()` — read `oc`, loop `get-order`, filter `status == 0`,
  return `{ orderId, owner, amt, targetUsd }[]`.
- **Trigger eval (`limit-push.ts`, new module):** reuse `fetchPrices()` from `price-push.ts`
  (CoinGecko, behind the existing circuit breaker) for sBTC USD. For each open order, an
  order is fillable when `currentUsd <= targetUsd`. Compute `min-amount-out` from a live
  `get-dy` quote on `POOL_SBTC_STX` for `net = amt - fee`, minus a slippage tolerance
  (config constant, default 1%).
- **Execution:** v1 executes orders **individually** (one `execute-order` tx each) — keeps
  the contract surface minimal (no `batch-limit-executor.clar`). Cap 10/user + few
  simultaneous triggers early on makes nonce cost acceptable. Batching is a fast-follow if
  volume grows. Each broadcast still records `{ txid, planIds: [orderId], status }` to
  `keeper:recent-batches` so reconcile + Telegram alerts work unchanged.
- **Wiring (`index.ts` / `runOnce()`):** after the DCA block, discover → eval → execute.
  Same run-lock, circuit breaker, and `keeper:last-run` heartbeat. RPC degradation fails
  fast as in DCA.
- **Notification:** on fill, send web push (VAPID, reuse push infra) and invalidate the
  `portfolio:<address>` tag so the portfolio recomputes immediately.

## Component 3 — Frontend + API

- **Location:** a new **"Limit Orders"** tab under `/trade`.
- **Components** (mirror `components/dca-out/`):
  - `components/limit/CreateLimitOrderForm.tsx` — STX deposit + target USD price; live
    preview "≈ X sBTC at current price" (reuse `dca-quote` / `getQuote`); distance-to-target badge.
  - `components/limit/MyLimitOrders.tsx` + `LimitOrderCard.tsx` — open/filled/cancelled list,
    Cancel button (refund), target vs current price.
  - Reuse wallet connect, `senderSpendPostCondition` (STX `ustx` branch already exists),
    `tx-tracker` + `trackTx(..., address)` to invalidate portfolio.
- **Contract calls (client-side):** `create-order`, `cancel-order` via a new
  `src/lib/limit-orders.ts` (mirror `dca.ts`: pure validation + build-params, separated for unit tests).
- **Data read:** extend `/api/portfolio/snapshot` (`portfolio-snapshot.ts` + selector in
  `usePortfolioSnapshot.ts`) to include open orders — follows the snapshot pattern; no standalone
  SWR hook. Tag `portfolio:<address>`, TTL 30s, invalidate after tx.
- **i18n:** add a `limit` namespace (or extend `trade`) for **EN + VI + ZH + JA** — the i18n
  parity test fails if any locale is missing.
- **Telemetry:** `order-created` / `order-filled` / `order-cancelled` via `lib/telemetry.ts`.

## Component 4 — Testing & rollout

### Tests

- **Contract** (`cd contracts && npm test` — the real gate):
  `tests/limit-order-vault_test.ts` — create (happy + MID + cap asserts), execute (fill, 0.3%
  fee, tokens to owner, `min-out` revert when unmet), cancel (refund, can't cancel filled),
  `open-count` inc/dec across create→fill and create→cancel, permissionless execute. Reuse
  `mock-sbtc-swap-router.clar` + `mock-sbtc.clar`.
- **Frontend unit** (`npm test`): `src/lib/limit-orders.test.ts` — pure validation + build-params
  characterization. Do not touch `direct-swap.test.ts` (STX→sBTC route unchanged → stays green).
- **Keeper unit:** `limit-push.test.ts` — trigger eval (`usd <= target` fills / `>` skips),
  `min-out` from quote + slippage, CoinGecko-null safe skip (reuse circuit breaker).
- **E2E** (`npm run test:e2e`): `e2e/limit-orders.spec.ts` mirroring `dca.spec.ts` — mock
  wallet creates an order on `/trade`, sees it listed, cancels. Keep baseline ~84 desktop / ~78 mobile.

### Rollout

Commit directly on `main`, fine-grained RED/GREEN commits, no Co-Authored-By trailer.

1. Contract + clarinet tests → deploy `limit-order-vault` to mainnet, record in
   `contracts/deployments` + `NEXT_PUBLIC_*` env.
2. Keeper path (after the contract is live) — verify against one small real order.
3. Frontend + API + i18n.
4. E2E + `npm run build` before each checkpoint commit.

USDCx→sBTC stays out of this spec (fast-follow: deploy the reverse router first).

## Out of scope (v1)

- USDCx→sBTC limit buy (needs a new on-chain reverse router)
- Take-profit / stop-loss / trailing stop
- Recurring conditional orders (overlaps Smart DCA)
- Batch execution contract for limit orders
- deposit-more / pause / resume on an order
