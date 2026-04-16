# DCA Vault V2 CLI Tool — Design Spec

## Goal

Build `tools/dca-v2.mjs` — a single-command CLI tool that covers the full DCA vault v2 lifecycle: create plan, execute swap, and cancel/refund. Each derived account signs its own transactions using the owner's private key.

## Contract

- **Address:** `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV`
- **Name:** `dca-vault-v2`
- **Target token:** `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` (sBTC)
- **Swap router:** `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router`

## Commands

### `create`

Create a DCA plan for each derived account. Each account deposits STX and sets up recurring swap parameters.

```bash
node tools/dca-v2.mjs create --amount 2 --interval daily --deposit 10 --accounts 40
```

**Flags:**
| Flag | Description | Default |
|------|-------------|---------|
| `--amount` | STX per swap (converted to uSTX internally) | required |
| `--interval` | `daily` (144 blocks), `weekly` (1008), `monthly` (4320) | required |
| `--deposit` | Initial STX deposit per plan (converted to uSTX) | required |
| `--accounts` | Number of accounts to derive | 40 |
| `--dry-run` | Scan balances only, no tx broadcast | false |

**Flow:**
1. Prompt mnemonic → derive accounts
2. For each account: check STX balance ≥ deposit + fee
3. Display table: account index, address, STX balance, deposit amount
4. Confirm → broadcast `create-plan` tx per account
5. Print tx IDs

**Contract call:** `create-plan(target-token, amount-per-interval, interval-blocks, initial-deposit)`

**Validations (contract-enforced):**
- `amount-per-interval` ≥ 1 STX (1,000,000 uSTX)
- `interval-blocks` ≥ 144 (1 day)
- `initial-deposit` ≥ 2 STX (2,000,000 uSTX)
- `initial-deposit` ≥ `amount-per-interval`
- User has < 10 existing plans

### `execute`

Execute the DCA swap for each account's eligible plans. Each account signs its own execute-dca transaction.

```bash
node tools/dca-v2.mjs execute --accounts 40 --slippage 0.1
```

**Flags:**
| Flag | Description | Default |
|------|-------------|---------|
| `--accounts` | Number of accounts to derive | 40 |
| `--slippage` | Slippage tolerance % | 0.1 |
| `--dry-run` | Scan only, no tx broadcast | false |

**Flow:**
1. Prompt mnemonic → derive accounts
2. For each account: call `get-user-plans` → get plan IDs
3. For each plan: call `can-execute` → filter eligible
4. For each eligible plan: fetch quote from Bitflow XYK pool (`get-dy`), apply slippage → `min-amount-out`
5. Display table: account, plan ID, balance, estimated STX→sBTC output
6. Confirm → broadcast `execute-dca` tx per eligible plan
7. Print tx IDs

**Contract call:** `execute-dca(plan-id, swap-router, min-amount-out)`

**Quote fetching:** Uses `xyk-core-v-1-2.get-dy` read-only call (same approach as `tools/swap-sbtc-to-stx.mjs`). Note: the DCA vault swaps STX→sBTC (opposite direction from swap-sbtc-to-stx tool), so the quote call uses STX as input token and sBTC as output token.

**XYK pool contracts:**
- Pool: `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1`
- Core: `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2`
- Token X (sBTC): `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`
- Token Y (wSTX): `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2`

Since DCA swaps STX→sBTC, the quote uses `get-dy` with x=wSTX, y=sBTC (swap Y for X direction). The actual quote function to use is `get-dx` (input Y, output X) or the reverse params. This needs verification against the XYK pool interface during implementation.

### `cancel`

Cancel all active plans for each account, refunding remaining STX balance.

```bash
node tools/dca-v2.mjs cancel --accounts 40
```

**Flags:**
| Flag | Description | Default |
|------|-------------|---------|
| `--accounts` | Number of accounts to derive | 40 |
| `--dry-run` | Scan only, no tx broadcast | false |

**Flow:**
1. Prompt mnemonic → derive accounts
2. For each account: call `get-user-plans` → get plan IDs
3. For each plan: call `get-plan` → check active status and balance
4. Display table: account, plan ID, active status, refundable balance
5. Confirm → broadcast `cancel-plan` tx per active plan
6. Print tx IDs and total refunded

**Contract call:** `cancel-plan(plan-id)`

## Architecture

Single file `tools/dca-v2.mjs` following the same pattern as existing tools (`swap-sbtc-to-stx.mjs`, `cancel-dca-plans.mjs`):

- Node.js ESM, shebang `#!/usr/bin/env node`
- `@stacks/transactions` for contract calls
- `@stacks/wallet-sdk` for 24-word Leather derivation
- `@scure/bip32` + `@scure/bip39` for 12-word Xverse derivation
- `@stacks/network` for STACKS_MAINNET
- readline prompt for mnemonic input
- Retry logic with exponential backoff for API calls (429/503 handling)

**Nonce management:** Each account sends at most 1 tx per command invocation (create: 1 create-plan, execute: 1 execute-dca per eligible plan, cancel: 1 cancel-plan per active plan). For accounts with multiple plans in execute/cancel, use sequential nonces via `fetchNonce` + increment.

**Rate limiting:** 500ms delay between API calls, 1s delay between tx broadcasts. Same pattern as existing tools.

## Constraints

- Max 10 plans per user (contract `MPPU`)
- Min 1 STX per swap, min 2 STX initial deposit
- Min interval 144 blocks (~1 day)
- Protocol fee: 0.3% per execute (deducted from swap amount)
- Tx fee: 2000 uSTX (0.002 STX) per transaction

## Error Handling

- Invalid mnemonic → exit with error
- Insufficient STX balance → skip account, log warning
- API rate limit (429/503) → exponential backoff retry (max 10 attempts)
- Contract error → log error code, continue to next account
- Broadcast failure → log reason, continue
