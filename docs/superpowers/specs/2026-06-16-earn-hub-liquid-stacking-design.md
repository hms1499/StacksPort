# Earn Hub v1 — Liquid Stacking (stSTX via StackingDAO)

**Date:** 2026-06-16
**Status:** Approved design, ready for implementation plan

## 1. Overview & Goal

Make liquid stacking **actionable in-app**. Today the repo already *reads* StackingDAO positions and *shows* a yield list, but the stacking entry in `YieldOpportunities` just links out to `stacking.club` — there is no in-app stake action anywhere (the only `openContractCall` flows are swap, migration, send, DCA).

v1 lets a user:
- **Stake STX → mint stSTX** via StackingDAO's `stacking-dao-core-v1` contract (non-custodial, instant liquid token).
- **See their stSTX position** (already read via `protocol-positions.ts`), with estimated APY.
- **Be nudged** when they have idle STX sitting in their wallet.
- **Unstake instantly** by deep-linking into the existing swap (stSTX → STX).

This is the first yield *action* of the broader "super app" Earn hub.

### Why liquid stacking (not Fast Pool delegation)

Chosen during brainstorming after discovering the real codebase already has the StackingDAO read-side built (`protocol-positions.ts`, stSTX in `token-registry.ts`, `getStackingStatus`/`getPoxCycleInfo`). Liquid stacking is therefore *less* work than delegated stacking here, has better UX (no lockup; stSTX is liquid and usable in the app's own swap), and reuses existing infra. Trade-off accepted: trusting StackingDAO's audited contracts/token.

### Non-goals (v1)

- Native StackingDAO delayed withdrawal (`init-withdraw` → claim NFT after cycle) — v1 unstake = swap stSTX→STX instead. **(v2)**
- Fast Pool / delegated stacking, solo stacking. **(v2)**
- Other yield sources beyond stSTX (Lisa, Arkadiko, Zest already *read* but stay read-only). **(v2)**
- Auto-compound management, referrer/pool selection UI. **(v2)**
- Any protocol fee. **(v2)**

## 2. Key Decisions (locked during brainstorming)

| Decision | Choice |
|----------|--------|
| Yield source | Liquid stacking — stSTX via StackingDAO |
| Mechanism | In-app `deposit` to `stacking-dao-core-v1` (mint stSTX), non-custodial |
| New contract | None — call StackingDAO's audited mainnet contract |
| Action scope | Stake + position view + smart idle-STX nudge |
| Unstake (v1) | Deep-link to existing swap (stSTX→STX); native delayed withdraw is v2 |
| Surface | Extend existing `YieldOpportunities` / assets surface (no new route in v1) |
| Rewards display | **Estimated APY headline**; position value (STX-equivalent of stSTX) as the concrete number |

> v1 deliberately extends the existing yield surface rather than adding a new `/earn` route. A dedicated route is a fast follow once there is more than one in-app action to host.

## 3. Architecture (fits the real repo)

### Contracts & tokens (constants)
- `src/lib/domain/stacking/contracts.ts` — mirrors `domain/swap/contracts.ts`. Holds:
  - StackingDAO core: `SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-v1`.
  - The **reserve** contract principal required by `deposit` (trait arg).
  - stSTX token asset id (from `token-registry.ts`: `ststx-token`) for post-conditions.
  - Minimum stake amount, STX fee buffer.

> Implementation note: the exact `deposit` signature (reserve trait arg, `amount`, optional `referrer`/`pool`) and the stSTX asset id are pinned and verified against the **published `stacking-dao-core-v1` mainnet interface** during the builder-test step (§7), not assumed from memory.

### Pure logic (TDD, colocated tests)
- `src/lib/domain/stacking/amount.ts` (+ `amount.test.ts`):
  - `idleStx(unlockedBalance, feeBuffer)` — STX eligible to stake.
  - `validateStakeAmount(amount, { min, available })` — returns ok / error reason.
  - `estimateStStxReceived(stxAmount, exchangeRate)` — stSTX is not 1:1 with STX; uses the protocol exchange rate.

### Action builder (orchestration)
- `src/lib/stacking-dao.ts` (flat, mirroring `dca.ts`):
  - `stakeStx(amountUstx, { addNotification, address })` — builds the `openContractCall` to `stacking-dao-core-v1.deposit` (`network: "mainnet"`), with **explicit post-conditions** (exactly `amount` STX leaves the wallet; stSTX is received) — a safety upgrade over DCA's permissive `postConditionMode: 1`. On broadcast, calls `trackTx()` (existing `tx-tracker.ts`) for notification + explorer link.

### Reads (reuse, don't rebuild)
- Position: existing `protocol-positions.ts` → `fetchStackingDaoPosition` (`get-stx-balance`) already returns the STX-equivalent staked.
- Stacking/PoX context + snapshot hooks: existing `getStackingStatus`, `getPoxCycleInfo`, `useStackingStatusSnap`.
- APY: reuse the conservative `apyRange` already in `YieldOpportunities` (sourced, labelled estimate); optionally refine later via `server/protocol-metrics.ts`. APY must not block shipping.

### UI (i18n across `messages/{en,ja,vi,zh}.json`)
- `StakeStxModal.tsx` — amount input, est. stSTX received + APY, lockup-free explainer, confirm → `stakeStx()`.
- **`YieldOpportunities.tsx` change** — the `stacking` entry's `stacking.club` external link becomes an in-app "Stake STX" CTA opening `StakeStxModal`. Keep "Learn more" as the external link.
- `IdleBalanceNudge.tsx` — surfaced on dashboard/assets: idle STX → "Stake ~N STX to earn ~X% as stSTX"; CTA opens the modal prefilled.
- Position display: confirm the StackingDAO position from `protocol-positions.ts` renders in the existing positions UI; add a stSTX "Staked" line + "Unstake" affordance (deep-link to swap) if not already present.

## 4. Data Flow

1. **Read:** assets/yield mounts → existing snapshot hooks + `fetchAllPositions` (StackingDAO) → render position + APY (existing patterns, skeletons).
2. **Stake:** `StakeStxModal` → amount → `validateStakeAmount` (`>= min`, `<= idleStx`) → show est. stSTX (`estimateStStxReceived`) → `stakeStx()` → `trackTx` notification + explorer link → refresh.
3. **Nudge:** `idle = unlockedBalance - feeBuffer`; if `idle >= min` and no meaningful stSTX position → render `IdleBalanceNudge`; CTA opens modal prefilled.
4. **Unstake (v1):** "Unstake" → deep-link to existing swap widget with stSTX→STX preselected. No new contract logic.

## 5. Rewards & Position Display

- **Headline = Estimated APY** (`~7–9%`): from the existing sourced `apyRange`, labelled an estimate. Always available.
- **Concrete number = position value**: STX-equivalent of the stSTX holding from `fetchStackingDaoPosition` (`get-stx-balance`), plus USD. This is real on-chain data, not an estimate.
- stSTX accrues value via exchange rate (not rebasing), so "rewards" surface as position growth over time rather than discrete payouts — no payout-history parsing needed.

## 6. Error / Edge Handling

- Wallet not connected → existing connect prompt.
- Amount below min / above idle → inline validation, confirm disabled.
- User rejects tx → toast, no state change (existing pattern).
- Read-only call / network failure → existing catch + retry.
- Post-condition failure (unexpected token movement) → tx aborts safely by design.
- stSTX exchange-rate fetch fails → show STX amount only, hide est. stSTX (don't block staking).

## 7. Testing

- **Unit (TDD, colocated):** `idleStx`, `validateStakeAmount`, `estimateStStxReceived` — pure functions in `domain/stacking/`.
- **Builder test:** assert the `stakeStx` `openContractCall` payload (contract id, `deposit` fn, trait/amount args, post-conditions) by mocking `@stacks/connect`. This is where the StackingDAO signature + stSTX asset id are verified against the published interface.
- **Component tests:** `StakeStxModal` states (idle/valid/invalid/submitting); `YieldOpportunities` actionable CTA; nudge eligibility.
- **E2E:** add a stake flow to the existing Playwright `e2e/` suite (mocked wallet); assert the modal opens from `YieldOpportunities` and builds the expected call.
- **i18n:** verify new keys exist in all four locale files (en, ja, vi, zh).

## 8. Build Approach

Per user preference, the implementation plan must break work into the **smallest reasonable, independently-verifiable steps** with incremental commits. Suggested ordering:
1. `domain/stacking/contracts.ts` constants (pin StackingDAO ids/signature).
2. `domain/stacking/amount.ts` pure helpers + tests (TDD).
3. `stakeStx` action builder + builder test (pin deposit payload + post-conditions).
4. i18n keys (4 locales).
5. `StakeStxModal` + component tests.
6. Wire `YieldOpportunities` CTA (replace external link).
7. `IdleBalanceNudge` + placement.
8. Position display + "Unstake" deep-link to swap.
9. E2E stake flow.
