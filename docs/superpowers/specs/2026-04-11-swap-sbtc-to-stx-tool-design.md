# Swap sBTC → STX Tool Design

## Overview

A CLI tool that scans all derived wallet accounts for sBTC balances and swaps each one directly to STX in-place, using the Bitflow XYK pool contract on Stacks mainnet. Follows the same structure and conventions as existing sweep tools (`sweep-sbtc.mjs`, `sweep-stx.mjs`, `sweep-usdcx.mjs`).

**File:** `tools/swap-sbtc-to-stx.mjs`

---

## Usage

```bash
node tools/swap-sbtc-to-stx.mjs
node tools/swap-sbtc-to-stx.mjs --accounts 50 --slippage 0.5
node tools/swap-sbtc-to-stx.mjs --dry-run
```

---

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--accounts N` | 33 | Number of derived accounts to scan |
| `--slippage N` | 0.1 | Slippage tolerance in percent (e.g. `0.1` = 0.1%) |
| `--dry-run` | off | Scan and quote without broadcasting transactions |

---

## Flow

```
1. Parse CLI args
2. Prompt mnemonic (12 or 24 words)
3. Derive accounts
   - 12 words → Xverse BIP44: m/44'/5757'/{i}'/0/0
   - 24 words → Leather via @stacks/wallet-sdk
4. Scan balances for each account
   - sBTC balance via Hiro API /extended/v1/address/{addr}/balances
   - STX balance via Hiro API /extended/v1/address/{addr}/stx
5. Fetch quote for each swappable account
   - Read-only call: xyk-core-v-1-2.get-dy(pool, sBTC, wSTX, amountIn)
6. Display summary table
   - index | address | sBTC in | STX out (est.) | STX current balance
7. Confirm yes/no
8. Execute swap for each account
   - makeContractCall: xyk-core-v-1-2.swap-x-for-y(...)
   - minAmountOut = quote × (1 - slippage / 100)
   - Retry up to 8 times on 429/503
   - 3s delay between broadcasts
9. Print summary: N sent, N failed
```

---

## Skip Conditions

An account is skipped if:
- sBTC balance = 0
- STX balance < 2000 microSTX (insufficient for tx fee)

Skipped accounts are counted and reported with a `⚠ low STX` warning in the table.

---

## Contract Details

### Quote (read-only)

```
Contract : SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
Function : get-dy
Args     : [pool, x-token, y-token, dx]
           pool    = SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1
           x-token = SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
           y-token = SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
           dx      = sBTC amount in satoshis (uint)
Returns  : (ok uint) — estimated STX out in microSTX
```

### Swap (transaction)

```
Contract : SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
Function : swap-x-for-y
Args     : [pool, x-token, y-token, dx, min-dy]
           pool    = SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1
           x-token = SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
           y-token = SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
           dx      = sBTC amount in satoshis (uint)
           min-dy  = floor(quote × (1 - slippage / 100)) in microSTX (uint)
Fee      : 2000 microSTX (0.002 STX)
PostConditionMode: Allow
```

---

## Token Constants

| Token | Contract |
|-------|----------|
| sBTC | `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` |
| wSTX | `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2` |
| Pool | `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1` |
| XYK Core | `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2` |

---

## Error Handling

- Rate limit (429/503): exponential backoff, retry up to 8 attempts
- Broadcast error (`"error" in result`): log `result.reason`, increment failed count, continue
- Network exception: log first 80 chars of error message, continue
- After all retries exhausted: mark as failed

---

## Output Example

```
========================================
  sBTC → STX Swap Tool — Mainnet
========================================
  XYK Pool  : SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1
  Accounts  : 33
  Slippage  : 0.1%
  Dry run   : no
  Tx fee    : 0.002000 STX (per swap)
========================================

Deriving wallet...
  Mode: Xverse (BIP44 account-level derivation)
✓ Derived 33 accounts

Scanning sBTC balances and fetching quotes...

  #   Address          sBTC In           STX Out (est.)    STX Balance
  ─── ──────────────── ──────────────── ──────────────── ──────────────
    0  SP2CM...13SV     0.00000000                   —      1.250000 ◀ skip (no sBTC)
    1  SP3AB...7XYZ     0.00050000        1,234.567890      0.005000
    2  SP1DE...9ABC     0.00000000                   —      0.000000  (no sBTC)

────────────────────────────────────────────────────────────────
  Accounts to swap    : 1
  Total sBTC in       : 0.00050000 sBTC
  Total STX out (est.): ~1,234.567890 STX
  Total fees          : 0.002000 STX
────────────────────────────────────────────────────────────────

Swap 0.00050000 sBTC across 1 accounts? (yes/no): yes

Sending transactions...

  [1] SP3AB...7XYZ → 0.00050000 sBTC → ~1,234.567890 STX ... ✓ 0xabc123...

========================================
  Done! 1 sent, 0 failed
  Explorer: https://explorer.hiro.so/txid/<txid>?chain=mainnet
========================================
```
