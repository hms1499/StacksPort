# BTC → sBTC Deposit On-Ramp — Design

**Date:** 2026-06-24
**Status:** Approved (architecture), pending spec review
**Scope:** MVP — deposit direction only (BTC → sBTC). Withdrawal (sBTC → BTC) is a later phase.

## Problem

Every core StacksPort feature — DCA, earn, swap, limit orders — requires the user to
already hold sBTC. But acquiring sBTC is **not** possible in-app: `SBTCMonitor.tsx`
(line 299-312) only links out to `app.stacks.co` to bridge. The app already *reads*
bridge activity (`getSBTCData` in `src/lib/stacks.ts:552` returns peg status + bridge
history) but the actual deposit happens off-site. This is the biggest acquisition-funnel
leak: we turn users away at the exact moment they want to start.

**Goal:** Let a user mint sBTC from BTC fully in-app, non-custodially, and track the
deposit to completion with a push notification when sBTC lands.

## Key Constraints

- BTC → sBTC is a **Bitcoin-layer** flow, not a Stacks contract call. The user signs a
  Bitcoin transaction; sBTC signers mint sBTC after ~3 Bitcoin confirmations
  (typically 30+ minutes). It is **not** instant.
- Non-custodial: the user's own wallet (Leather/Xverse) signs and broadcasts the BTC tx.
  We never hold keys.
- Wallet already exposes a BTC address — `wallet.ts:18` captures `btcAddress` from
  `@stacks/connect`. We additionally need the **BTC public key** (for `reclaimPublicKey`),
  which `connect()` returns but `parseWalletAddresses` does not currently keep.
- sBTC has a **minimum deposit** plus a signer fee (`maxSignerFee`, default 80,000 sats).
  Must validate before signing.

## sBTC SDK — Grounded API

Confirmed against Stacks docs (package `sbtc`, not yet installed). Non-custodial
browser path:

```ts
import { buildSbtcDepositAddress, MAINNET, SbtcApiClientMainnet } from 'sbtc';
import { request } from '@stacks/connect';

const client = new SbtcApiClientMainnet(); // SbtcApiClientTestnet for testnet

// 1. Build deposit address
const deposit = buildSbtcDepositAddress({
  stacksAddress,                                  // mint sBTC to this STX addr
  signersPublicKey: await client.fetchSignersPublicKey(),
  reclaimPublicKey,                               // user's BTC pubkey (for failed-deposit reclaim)
  reclaimLockTime: 950,
  maxSignerFee: 80_000,
  network: MAINNET,
});
// deposit.address (P2TR), deposit.depositScript, deposit.reclaimScript

// 2. User's wallet signs & broadcasts the BTC tx (non-custodial)
const { txid } = await request('sendTransfer', {
  recipients: [{ address: deposit.address, amount: amountSats }],
});

// 3. (server, once tx in mempool) notify signers
const transaction = await client.fetchTxHex(txid);
await client.notifySbtc({ transaction, ...deposit });

// 4. poll status
await client.fetchSbtcBalance(stacksAddress);
```

We use the `request('sendTransfer')` path (user wallet broadcasts), **not**
`sbtcDepositHelper` (which signs with a raw private key — server/custodial only).

## Architecture

A reusable **"Get sBTC" modal** (client) + a **persistence API** + a **cron reconciler**.

| Layer | Responsibility | Runs |
|---|---|---|
| `src/lib/sbtc-deposit.ts` | wrap `sbtc` pkg: build deposit address, fetch signers key & fee rate, validate min amount, parse Emily status | client + server |
| `src/components/sbtc/GetSbtcModal.tsx` | 3-step UX: enter amount → review (fee / min / ETA) → sign `sendTransfer` | client |
| `POST /api/sbtc/deposit` | persist `{txid, stacksAddress, amountSats, depositScript, reclaimScript}` to Redis | server |
| `GET /api/sbtc/deposits?address=` | read a user's deposits with live status | server |
| `GET /api/cron/sbtc-reconcile` | scan pending → when tx in mempool call `notifySbtc` → poll Emily → on mint: web push + portfolio invalidate + cleanup | Vercel Cron |

### Decision: `notifySbtc` runs server-side (in cron), not client

If the user closes the tab right after broadcasting BTC, the signers must still get
notified or the deposit stalls. So the **client only** builds the address, signs the
`sendTransfer`, and POSTs to persist. The **cron** owns `notifySbtc` + status polling +
push. More robust, and consistent with the keeper-bot reconcile pattern.

### Decision: Vercel Cron in the Next app, separate from keeper-bot

The reconciler is a Next API route (`/api/cron/sbtc-reconcile`) on a Vercel Cron
schedule, **not** folded into the DCA keeper-bot. Keeps sBTC-deposit concerns out of
the DCA batch executor; reuses the same Upstash Redis.

## Entry Points

Reusable `GetSbtcModal`, opened from:
- `SBTCMonitor.tsx` — replace the out-link to `app.stacks.co` (line 299-312) with a
  button that opens the modal.
- `/trade` — a "Get sBTC" button/tab.
- "You need sBTC" nudge in DCA / earn when sBTC balance = 0.

## Data Flow (one deposit)

```
User enters amount
  → build deposit addr (signersKey + reclaimPubKey from wallet)
  → request('sendTransfer') → wallet signs & broadcasts BTC → txid
  → POST /api/sbtc/deposit   (Redis: status=broadcast)

Cron every ~2–3 min:
  broadcast → (tx in mempool?) → notifySbtc → status=notified
  notified  → (Emily: minted?) → status=minted → web push + portfolio invalidate → cleanup
```

**Redis:** key `sbtc:pending:<stxAddress>` (hash keyed by txid), TTL ~7 days.
Entry: `{ txid, amountSats, status, createdAt, depositScript, reclaimScript }`.
Statuses: `broadcast` → `notified` → `minted` (terminal) / `expired` (TTL).

## Error Handling & Edge Cases

- **Min deposit / fee:** validate `amountSats >= min + maxSignerFee` before allowing sign;
  show the breakdown (deposit, signer fee, you receive) in the review step.
- **`reclaimPublicKey`:** extend `parseWalletAddresses` (`wallet.ts`) + `walletStore` to
  capture the BTC public key from `connect()` alongside the address.
- **Wallet lacks `sendTransfer`:** detect and fall back to a message + retain the external
  bridge link.
- **Failed / unconfirmed deposit:** entry expires via TTL. Automatic reclaim of stuck
  funds is **out of MVP scope** (the reclaim script is still recorded for a future phase).
- **Idempotency:** cron acquires a Redis lock (keeper-style `sbtc-reconcile:run-lock`) so
  overlapping cron runs don't double-`notifySbtc`.

## Testing

- `sbtc-deposit.ts` (pure): build address, min-amount validation, Emily status parsing —
  **unit tests** with a mocked `SbtcApiClient`.
- Cron reconciler state machine (`broadcast → notified → minted`) — unit tests with a
  mocked Emily client.
- **Testnet-first:** build behind `SBTC_NETWORK=testnet` using `SbtcApiClientTestnet` so
  development costs no real BTC; then **one small real mainnet smoke** (matches the
  project's established "mainnet smoke pending" gate).
- E2E (Playwright): mock wallet, verify the 3-step modal UX + tracking states; do **not**
  broadcast real BTC.

## Out of Scope (MVP)

- Withdrawal sBTC → BTC (separate signer/contract flow — later phase).
- Automatic reclaim of stuck/failed deposits.
- Fiat → BTC on-ramp.

## Open Risks to Validate Early

1. Exact shape of `connect()` BTC public-key field in `@stacks/connect@8.2.5` (needed for
   `reclaimPublicKey`).
2. `request('sendTransfer')` support & behavior across Leather and Xverse.
3. `sbtc` package's testnet client name/exports and Emily testnet endpoint availability.
