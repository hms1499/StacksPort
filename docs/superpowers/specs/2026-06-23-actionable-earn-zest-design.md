# Actionable Earn — Zest Supply/Withdraw Design

**Date:** 2026-06-23
**Status:** Approved (brainstorm); re-scoped after on-chain verification — see Update
**Surface:** `/earn`

> **Update (2026-06-23, post-verification):** On-chain verification revealed Zest is an
> **Aave-style protocol** (`borrow-helper-v2-0`) whose supply/withdraw/collateral calls
> take **trait references** (lp a-token, pool-reserve, asset, oracle) and, for
> withdraw/collateral, a full **list of the user's collateral reserves** — materially
> heavier than the "mirror StakeStxModal" assumption below. Also, the Zest "USDC" market
> is **ambiguous**: DefiLlama lists `usdcx` as the underlying, but live supply txs use
> **aeUSDC** (`token-aeusdc` → `zaeusdc-v2-0`). **Decision:** the first implementation
> plan is re-scoped to **sBTC only, supply + withdraw** (collateral toggle and USDC
> deferred). Verified sBTC constants and the task breakdown live in
> `docs/superpowers/plans/2026-06-23-actionable-earn-zest-sbtc.md`.

## Goal & Scope

Turn the Zest entries on `/earn` from **informational APY display** into **in-app
actionable** flows. Users can supply sBTC and USDC into Zest, withdraw, and toggle
collateral — all signed with their own wallet (Leather/Xverse), non-custodial.

This continues the `/earn` yield-dashboard work (DefiLlama Zest APY + StackingDAO
APY already shipped) by making the dashboard *do* something, not just *show*.

STX staking is **already actionable** via `StakeStxModal` (StackingDAO liquid
staking → stSTX); this work fills the remaining gap: Zest lending.

### Decisions locked during brainstorm
- **Assets (first pass):** sBTC + USDC.
- **UX surface:** per-action modals, mirroring `StakeStxModal` (not a panel or
  tabbed widget). Keeps consistency with existing staking flow and minimizes new
  code.
- **Position read source:** the per-address **portfolio snapshot** (server
  aggregator, 30s cache, per-address tag, auto-invalidated after tx confirms).
- **Collateral:** a **separate toggle** on a supplied position (its own on-chain
  call). Supply is supply (1 tx). Collateral is enable/disable on an existing
  position. No bundled 2-tx flow.

## ⚠️ Prerequisite — on-chain verification (first RED task, do NOT guess)

Per repo rule (CLAUDE.md / ROUTE_TABLE discipline): every contract id, function
name, and SIP-010 asset name must be verified against the chain before wiring. No
guessing. Before any implementation, verify and record:

- Zest lending pool **contract id** on mainnet (deployer principal + contract name).
- Real **function names + signatures** for supply / withdraw / set-collateral.
- Exact **SIP-010 asset name** of sBTC and of the USDC variant the pool accepts.
  USDC on Stacks has multiple variants (aeUSDC / USDCx); the variant the Zest
  USDC pool actually accepts determines the supply token *and* the post-condition
  asset. DefiLlama exposes the pool only as symbol `USDC` — this must be resolved
  to a concrete token contract.
- The **receipt token** minted on supply (z-token / aToken) and the **read-only
  function** to read a user's supplied balance + collateral flag.

Sources: Hiro API (`/v2/contracts/interface/<addr>/<name>`), DefiLlama pool
metadata (`project: zest-v2`, `chain: Stacks`), on-chain reads. If one asset
cannot be verified, ship the other and do not block.

## Architecture

Mirrors the established `domain/stacking` + side-effect + snapshot-read pattern.

### Domain layer (pure, unit-tested) — `src/lib/domain/zest/`
- `contracts.ts` — verified contract ids; per-asset metadata `{ tokenId, sip010
  AssetName, decimals, minSupplyMicro, zToken }`.
- `amount.ts` — `validateSupplyAmount`, `validateWithdrawAmount`,
  `estimateZTokenReceived`, min / insufficient-balance / withdraw-exceeds-supplied
  logic. No I/O.
- `clarity.ts` — `buildSupplyParams`, `buildWithdrawParams`,
  `buildSetCollateralParams`, each returning
  `{ contractAddress, contractName, functionName, functionArgs, postConditions,
  postConditionMode }`. Post-conditions are **per-asset** (FT amount of the exact
  SIP-010 asset for supply; receipt-token / withdraw asset for withdraw).
- `position.ts` — parse a read-only result into
  `{ asset, suppliedMicro, collateralOn }`.

### Side-effect layer — `src/lib/zest.ts`
Mirror `stacking-dao.ts`: `supplyZest()`, `withdrawZest()`, `setZestCollateral()`
via `openContractCall` (network `mainnet`, `onFinish` / `onCancel`). Each action
calls `trackTx(..., { address })` so the per-address portfolio tag is invalidated
on confirm/abort.

### Server read — `src/lib/server/zest-read.ts`
`getZestPositions(address)` does the read-only contract call(s) (mirror
`limit-orders-read.ts`) and returns `ZestPosition[]`. Wired into
`portfolio-snapshot.ts` as a new field `zestPositions: ZestPosition[] | null`
fetched through `safe()` so Zest degrades independently. Selector added to
`usePortfolioSnapshot.ts`.

### UI — `src/components/earn/`
- `SupplyZestModal.tsx` / `WithdrawZestModal.tsx` — clones of `StakeStxModal`:
  amount input, "≈ receive z-token" estimate, validation, tx state, notification.
- `YieldOpportunities.tsx`: the Zest rows (sBTC, USDC) get a **Supply** button
  opening the matching modal (replacing the external link). When a position
  exists, show supplied balance + a **Withdraw** button + a **collateral toggle**
  (calls `setZestCollateral`).
- i18n: new keys added to the `earn` namespace for **all 7 locales**; parity test
  must stay green.

## Data Flow

1. Snapshot read → `zestPositions` → `usePortfolioSnapshot` selector →
   `YieldOpportunities` renders supplied balance + collateral state.
2. User clicks Supply → modal validates (domain `amount.ts`) → `buildSupplyParams`
   → `supplyZest()` `openContractCall` → user signs.
3. `trackTx(txId, { address })` watches; on confirm it POSTs
   `/api/portfolio/invalidate` → next snapshot read recomputes the position.
4. Withdraw and collateral toggle follow the same path with their own param
   builders.

## Error Handling

- Reads are **fail-invisible**: null → hide estimate/position, never block. Matches
  existing yield/stacking behavior.
- Client-side validation blocks invalid supply/withdraw (below min, insufficient
  balance, withdraw > supplied). Post-conditions enforce on-chain.
- Snapshot uses `safe()` → a Zest read failure degrades only the Zest field, not
  the whole snapshot.

## Testing

- Unit (vitest): `amount.test.ts`, `clarity.test.ts` (characterization — assert
  exact params, in the style of `direct-swap.test.ts`), `position.test.ts`.
- i18n parity test for the new `earn` keys.
- Final gate: `npm test` + `npm run build`, then **one real supply on mainnet per
  asset** to verify the live flow (consistent with prior "verify 1 real flow"
  deploy discipline).

## Out of Scope (YAGNI)

Borrow / repay, health-factor display, multi-protocol aggregation, auto-compound.
The collateral toggle ships as groundwork only; lending/borrow is a later sprint.
