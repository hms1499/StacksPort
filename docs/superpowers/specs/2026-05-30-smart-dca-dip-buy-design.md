# Smart DCA — Conditional "Buy-the-Dip" Design (v1)

**Date:** 2026-05-30
**Status:** Approved design — ready for implementation plan
**Scope:** STX→sBTC accumulation vault only (vault type 0)

## 1. Goal & Principles

Let a STX→sBTC DCA plan carry an **optional dip condition**. When the contract
says a plan is due (unchanged interval logic), the keeper only includes it in the
execution batch if the current **sats/STX exchange rate is at least a threshold
above its 7-day average** — i.e. one STX buys meaningfully more sats than usual.
If the condition is not met, the plan is **skipped this run** and re-evaluated on
the next keeper run. After a plan has been deferred more than `maxDeferIntervals`
times, it executes at market to preserve DCA discipline.

### Invariants (non-negotiable)

- **Off-chain & additive.** No contract change. No change to the existing
  `execute-dca` / `batch-execute-dca` calls. A plan with no Smart DCA config
  behaves exactly as today (backward compatible).
- **Keeper can only delay, never lose funds.** The worst-case effect of this
  feature is deferring an execution. It cannot move or misdirect user funds.
- **Fail-open.** If the price signal cannot be computed (CoinGecko down, Redis
  down), the plan executes as a normal scheduled DCA. Infrastructure failure must
  never cause a user to silently miss buys.

## 2. Why off-chain / why this metric

- The contract has no on-chain price oracle, and contract versioning is marked
  SKIPPED in the system-design roadmap. On-chain enforcement would require an
  oracle integration plus a redeploy — heavy and out of scope.
- The keeper is already the trusted executor (it decides which due plans to
  batch). Layering a price filter onto plan selection is a natural extension.
- The signal is the **sats/STX swap rate**, not BTC/USD or STX/USD alone, because
  the user is accumulating sBTC by spending a fixed amount of STX per interval.
  More sats per STX = a better accumulation entry. This is the metric that
  actually maximizes sBTC accumulated, independent of USD framing.

## 3. Data Model (Upstash Redis)

Keyed by vault type (0) + on-chain plan id:

```
smart-dca:v0:{planId}        → JSON config (below)
smart-dca:v0:{planId}:defer  → integer, consecutive intervals deferred
```

Config shape:

```jsonc
{
  "owner": "SP...",          // plan owner address (display + filtering)
  "thresholdBps": 500,        // 5.00% — how far above the 7d average sats/STX must be
  "windowDays": 7,            // SMA window
  "maxDeferIntervals": 2,     // skip at most K due intervals before a market buy
  "createdAt": 1730000000     // unix seconds
}
```

Defaults: `thresholdBps = 500` (5%), `windowDays = 7`, `maxDeferIntervals = 2`.

### Auth & trust assumption

Config writes are authenticated by `address` query/body param, mirroring the
existing `/api/price-alerts` pattern (server is the source of truth; no signature).
This is acceptable because a forged write can only **delay** another user's DCA,
never access funds. The trust assumption is documented here deliberately. If a
stronger guarantee is wanted later, a SIP-018 signed-message gate can be added
without changing the data model.

## 4. Keeper Logic (`keeper-bot/src/smart-dca.ts`)

Inserted into `runOnce()` **between** "scan executable plans" and "chunk into
batches", applied only to vault-0 plans.

1. **Build the signal once per run.** Fetch the longest needed window (30-day cap)
   of STX/USD and BTC/USD series from CoinGecko `market_chart`. Derive
   `satsPerStx[t] = STX_USD[t] / BTC_USD[t] * 1e8` once. Fetch the current spot
   from `simple/price` (already used by `price-push.ts`) and derive current
   sats/STX from the same two prices. Using one source for both current and
   average keeps the comparison consistent. The SMA is computed **per plan** over
   that plan's own `windowDays` (a cheap average over a slice of the shared
   series), since configs may use different windows.
2. **Per due vault-0 plan:**
   - No config in Redis → keep in batch (normal DCA).
   - Has config → `premium = current / sma - 1`.
     - `premium >= thresholdBps/10000` → **execute** (dip hit); set `defer = 0`.
     - else → increment `defer`. If `defer > maxDeferIntervals` → **execute**
       (market fallback); set `defer = 0`. Otherwise → **remove from batch**
       (skip this run).
3. **Fail-open.** If the signal cannot be built (CoinGecko error) or Redis is
   unreachable, treat all plans as configless and execute normally. Reuse the
   existing Hiro circuit-breaker / logging conventions; log a structured warning.
4. **Counter reset.** After a batch broadcasts successfully, reset `defer = 0`
   for the vault-0 plan ids in that chunk that had a config (the keeper already
   has the chunk's plan ids in `index.ts`).

### Per-run defer increment caveat

`defer` counts keeper runs where the plan was due-but-skipped, not blockchain
intervals. Because a plan stays due until executed, every keeper run while the
dip is unmet increments `defer`. `maxDeferIntervals` is therefore expressed in
**keeper runs**, and the UI copy will say "checks" rather than "intervals" to
avoid implying block-interval semantics. (Keeper cron cadence is the unit.)

## 5. API + Frontend

### API routes (server-side proxy pattern, under `src/app/api/dca/smart/`)

- `GET  /api/dca/smart?address=` → list of the caller's Smart DCA configs.
- `POST /api/dca/smart` `{ address, planId, thresholdBps, windowDays, maxDeferIntervals }`
  → create or update. Validates ranges (see §6).
- `DELETE /api/dca/smart` `{ address, planId }` → remove the condition (revert to
  plain DCA).
- `GET /api/dca/smart/signal?windowDays=` → read-only current `satsPerStx`,
  `sma`, `premium` for the live status display. Computed in the Next.js route
  from the existing `market/snapshot` data (STX 7d history + current prices) —
  it does **not** import keeper code.

### UI

- In the create-plan flow (after the plan tx confirms and the new `planId` is
  known) and in an edit panel on the plan card: a "Smart DCA (buy the dip)"
  toggle plus two inputs — threshold % and max-defer K.
- Live status line driven by `GET /api/dca/smart/signal`:
  *"Waiting for dip: now +2.1% / need +5% — skipped 1/2 checks."*
- New Zustand store `smartDcaStore` mirroring the server via an SWR hook. The
  four existing stores (`walletStore`, `notificationStore`, `priceAlertStore`,
  `themeStore`) are untouched.

### Notifications (v1 decision)

No new per-defer push (too noisy). The existing DCA execution push is extended
with a flag indicating the buy landed on a dip (`premium` at execution), so the
user sees "bought the dip (+6% better than avg)" in the normal execution notice.

## 6. Error Handling, Testing, Non-Goals

### Error handling

- Redis unavailable → treated as "no config" → normal DCA (fail-open).
- CoinGecko error / insufficient history → fail-open, structured warning log.
- Config validation at the API boundary: `thresholdBps` 0–5000, `windowDays`
  1–30, `maxDeferIntervals` 0–10. Reject out-of-range with 400.

### Testing

Pure functions are extracted and tested first (TDD), in the style of this week's
characterization work:

- `computeSatsPerStxSeries(stxUsd[], btcUsd[])` → sats/STX series.
- `sma(series, windowDays)` → average.
- `evaluateDipCondition({ current, sma, thresholdBps, deferCount, maxDeferIntervals })`
  → `{ action: "execute" | "skip", reason }`.

Table tests cover: dip-hit executes; below-threshold skips; defer-cap forces
market execute; fail-open path. Plus: API route validation tests; a keeper
integration test with a mocked price feed and Redis.

### Non-goals (deferred to v2)

- sBTC→USDCx vault ("sell-high" inverse condition).
- Catch-up / double-down buying to compensate missed intervals.
- Alternative condition types (absolute price threshold, 24h drop).
- On-chain oracle enforcement.

## 7. Decomposition for the plan

Independent-ish units the implementation plan will sequence:

1. Pure signal/decision functions + unit tests in `keeper-bot/src/smart-dca.ts`
   (the enforcement source of truth — `computeSatsPerStxSeries`, `sma`,
   `evaluateDipCondition`). The frontend signal endpoint does its own thin premium
   calc from `market/snapshot`; the two packages stay build-decoupled. The small
   math duplication is intentional and accepted (same precedent as the duplicated
   `blocksToInterval` noted in the pure-function watchlist).
2. Redis store helpers (get/set/delete config, defer counter) + tests.
3. API routes (`GET`/`POST`/`DELETE` + `signal`) + validation tests.
4. Keeper integration in `runOnce()` (filter step + counter reset) + integration test.
5. Frontend: `smartDcaStore`, SWR hook, create/edit UI, live status line.
6. Extend DCA execution push with the dip flag.
