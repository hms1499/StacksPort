# Reverse Routes + USDCx Exit — Design

**Date:** 2026-06-20
**Status:** Approved (architecture), pending spec review
**Area:** Trade tab — swap routing (`src/lib/domain/swap/*`, `contracts/`)

## Problem

The Trade tab's SwapWidget exposes 3 routes today: `STX→sBTC`, `sBTC→STX`,
`sBTC→USDCx`. Two product gaps and one latent bug:

1. **USDCx is a dead-end.** There is no route with `from: "usdcx"`. A user can
   swap *into* USDCx but never back out via swap (only via the aeUSDC
   MigrationWidget). There is also no direct `STX→USDCx`.
2. **Latent bug: `router`-method user swaps do not work.** The `method:
   "router"` routes (`STX→sBTC`, `sBTC→USDCx`) point their `exec.contract` at
   the **DCA-vault routers** (`bitflow-sbtc-swap-router`,
   `bitflow-usdcx-swap-router`). Those contracts run every hop inside
   `as-contract`, swapping **their own balance**, on the assumption that "the
   vault transfers funds to this contract first." They never pull funds from
   `tx-sender`. When a user calls them directly via `openContractCall`:
   - hop 1 swaps the router's own balance (0) → aborts; and
   - `buildSwapParams` sets `PostConditionMode.Deny` with `willSendEq(amount)`
     for the user, which is violated because the user sends nothing.

   Evidence: 200 on-chain transactions to `bitflow-sbtc-swap-router` are
   **100% `execute-dca`** — zero direct user `swap-stx-for-token` calls. The
   only user-callable route that works today is the single-pool `direct` route
   `sBTC→STX` (calls `xyk-core.swap-x-for-y` directly, pulling sBTC from the
   user).

## Goal

Full bidirectional symmetry across the 3 swap tokens (STX, sBTC, USDCx), so the
SwapWidget supports every directed pair as a real user swap:

| Route        | Pools                          | Mechanism                          |
|--------------|--------------------------------|------------------------------------|
| STX↔sBTC     | 1 (xyk sbtc-stx)               | `direct` (no deploy)               |
| sBTC→STX     | 1                              | `direct` (already works)           |
| STX↔USDCx    | 2 (via aeUSDC)                 | new user router (deploy)           |
| USDCx↔sBTC   | 3                              | new user router (deploy)           |

DCA flow is untouched: the existing `bitflow-*-swap-router` contracts stay as
they are; new user swaps use a **new, separate** contract.

## Architecture & Phasing

Built directly on `main` (project convention: no feature branches). Mainnet
deployment in Phase 1 is an explicit confirmation checkpoint — not automatic.

### Phase 0 — Quick win, no deploy (ships independently)

`STX→sBTC` is a **single pool** (`xyk-pool-sbtc-stx`); it never needed a router.
Re-wire it from `method: "router"` to `method: "direct"` calling
`xyk-core.swap-y-for-x` (y=wSTX → x=sBTC), which pulls native STX from the user
(via the `token-stx-v-1-2` façade — see below). This fixes one currently-broken
direction with zero contract risk.

- Edit `ROUTE_TABLE` entry `stx→sbtc`: `method: "direct"`, `quote` hop uses
  `get-dx` on `POOL_SBTC_STX` (y-amount = STX in), `exec` becomes
  `{ kind: "direct", contract: XYK_CORE, fn: "swap-y-for-x", pool:
  POOL_SBTC_STX, xToken: SBTC, yToken: WSTX }`.
- `senderSpendPostCondition` already covers `stx`.
- Update the characterization test for `stx→sbtc` (it currently asserts the
  router contract/fn — this is an intentional, documented byte-change).

### Phase 1 — Contracts (Clarity + mainnet deploy)

**One new contract** `stacksport-swap-router` deployed under
`SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV`, with 4 public functions. All share
the signature `(amount-in uint) (min-amount-out uint) (recipient principal)` so
`buildSwapParams`'s `router` branch needs **no change**.

| Function              | Path                          | Hop legs (core.fn)                                                  | Output |
|-----------------------|-------------------------------|--------------------------------------------------------------------|--------|
| `swap-stx-for-usdcx`  | STX→aeUSDC→USDCx              | xyk swap-x-for-y; ss swap-x-for-y                                   | USDCx  |
| `swap-usdcx-for-stx`  | USDCx→aeUSDC→STX             | ss swap-y-for-x; xyk swap-y-for-x                                   | STX    |
| `swap-usdcx-for-sbtc` | USDCx→aeUSDC→STX→sBTC       | ss swap-y-for-x; xyk(stx-aeusdc) swap-y-for-x; xyk(sbtc-stx) swap-y-for-x | sBTC |
| `swap-sbtc-for-usdcx` | sBTC→STX→aeUSDC→USDCx       | xyk(sbtc-stx) swap-x-for-y; xyk(stx-aeusdc) swap-x-for-y; ss swap-x-for-y | USDCx |

Pool token ordering (confirmed via the existing DCA routers, all on
`SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR`):
- `xyk-pool-sbtc-stx-v-1-1`: x = sBTC, y = wSTX
- `xyk-pool-stx-aeusdc-v-1-2`: x = wSTX, y = aeUSDC
- `stableswap-pool-aeusdc-usdcx-v-1-1`: x = aeUSDC, y = USDCx

**Each function body:**
1. **Pull input from the user** (the one new step vs. DCA routers):
   - STX source: `(stx-transfer? amount-in tx-sender (as-contract tx-sender))`
   - FT source (sBTC / USDCx): `(contract-call? <token> transfer amount-in
     tx-sender (as-contract tx-sender) none)`
2. **Hops** inside `as-contract` (swap the contract's own balance), mirroring
   the DCA routers but in the right `swap-x-for-y` / `swap-y-for-x` direction;
   intermediate `min-out` = `u1`, final hop `min-out` = `min-amount-out`.
3. **Forward output** to `recipient`:
   - FT output: `(as-contract (contract-call? <out-token> transfer dy tx-sender recipient none))`
   - STX output: `(as-contract (stx-transfer? dx tx-sender recipient))`

**wSTX façade (resolves the STX-output risk):** `token-stx-v-1-2` is **not** a
balance-holding wrapper — it is a SIP-010 façade over native STX
(`get-balance` returns `(stx-get-balance address)`, `transfer` does
`stx-transfer?`). So a swap leg that "outputs wSTX" actually credits the
contract's **native STX**, and forwarding to the user is a plain
`stx-transfer?`. No wrap/unwrap step is needed.

### Phase 2 — Frontend wiring

- **`contracts.ts`**: add `ROUTER_STACKSPORT: TokenRef` for the new contract.
- **`ROUTE_TABLE`**: 4 new `RouteSpec` entries (plus the Phase-0 edit). Quote
  hops are real on-chain reads: forward legs `get-dy` (x→y), reverse legs
  `get-dx` (y→x). `exec` = `{ kind: "router", contract: ROUTER_STACKSPORT, fn }`.
- **`senderSpendPostCondition`**: add a `usdcx` branch
  (`willSendEq(amount).ft(USDCX_ASSET, "usdcx")`). `stx` and `sbtc` already
  covered.
- **UI**: `getValidDestinations` / `flipTokens` become richer automatically
  (data-driven). `SimpleTokenSelector` already lists all 3 tokens. No new UI
  components; verify flip is enabled for the new reverse pairs.

## Testing

- **Clarity** (`cd contracts && clarinet check` + `clarinet test`): the
  contract must compile (`clarinet check`, no new errors) and must not regress
  the existing suites (`clarinet test`, 77/77).
  - **Deviation (decided 2026-06-20, implementation):** the originally-planned
    clarinet mock-pool unit tests for the 4 functions were **not** written.
    The Bitflow cores/pools are mainnet-only and not in simnet, so a mock-pool
    test exercises hand-written mock math (our own code), not the real pool
    orderings or `token-stx-v-1-2` native-STX delivery the functions depend on
    — the same posture under which the existing DCA routers were validated on
    mainnet rather than simnet. The authoritative contract gate is therefore
    the **per-direction mainnet smoke swap** in the Deployment & Verification
    section, which the whole-branch review confirmed is the real ground truth.
    The cross-layer quote/exec direction correctness was verified by review
    against the on-chain pool orderings.
- **Frontend (TDD, `npm test`)**: extend `src/lib/direct-swap.test.ts`
  characterization suite:
  - per route: `exec` contract/fn, Deny mode, exact outgoing post-condition for
    the input token;
  - quote-hop wiring (mocked read-only) produces the expected multi-hop amount;
  - Phase-0 `stx→sbtc` direct re-wire (updated expectation).
- **`npm run build`** before each commit.
- **e2e** (`npm run test:e2e`): mock-wallet swap flow still passes for the new
  pairs (selectors / flip enablement).

## Deployment & Verification (Phase 1 checkpoint)

- Hand-trim the clarinet deployment plan to the **single** new contract +
  `clarinet deployments apply -d` (per the limit-order-vault deploy gotcha).
- After deploy, set `ROUTER_STACKSPORT` to the deployed id in `contracts.ts`.
- **Verify on mainnet**: execute one real swap in each new direction and confirm
  on the explorer — with special attention to `USDCx→STX` (the STX-output
  route) to confirm the user receives native STX.
- Expected `clarinet check` baseline still has the 3 known unresolved-contract
  errors (deployed-source fidelity); the real gate is `clarinet test`.

## Risks

1. ~~STX-output routes need an unwrap step~~ — **resolved**: `token-stx-v-1-2`
   is a native-STX façade; a Clarity test will assert native STX delivery.
2. **Pool token ordering wrong** → swap reverts or swaps wrong direction.
   Mitigated by reusing the orderings proven by the deployed DCA routers and by
   clarinet tests per leg.
3. **Mainnet deploy handles user funds.** New contract; explicit deploy
   checkpoint; the post-condition (Deny + `willSendEq` input) bounds the user's
   downside to exactly the input amount even if the router misbehaves.

## Out of Scope

- Adding new tokens beyond STX / sBTC / USDCx.
- Aggregator/path-router generalization (rejected: no usable Bitflow prod
  aggregator; one fixed-path contract is simpler and audit-friendly).
- `RecentSwaps` on-chain history, confirm modal, fee estimate (separate Trade
  backlog items).
