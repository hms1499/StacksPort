# Swap sBTC → STX Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `tools/swap-sbtc-to-stx.mjs` — a CLI tool that scans derived wallet accounts for sBTC, fetches a live swap quote from the Bitflow XYK pool, and swaps each account's sBTC to STX in-place via a direct contract call.

**Architecture:** Single `.mjs` script following the same structure as existing sweep tools. Reads wallet state from mnemonic, queries Hiro API for balances, calls `xyk-core-v-1-2.get-dy` read-only for quotes, then broadcasts `swap-x-for-y` transactions one account at a time with exponential-backoff retry.

**Tech Stack:** Node.js ESM, `@stacks/transactions` v7, `@stacks/wallet-sdk`, `@scure/bip32`, `@scure/bip39`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `tools/swap-sbtc-to-stx.mjs` | Complete standalone CLI swap tool |

No other files are created or modified.

---

### Task 1: Scaffold file — constants, imports, arg parsing

**Files:**
- Create: `tools/swap-sbtc-to-stx.mjs`

- [ ] **Step 1: Create the file with shebang, imports, constants, and arg parsing**

```javascript
#!/usr/bin/env node

/**
 * sBTC → STX Swap Tool
 * Swap sBTC to STX on each derived account in-place using Bitflow XYK pool.
 *
 * Usage:
 *   node tools/swap-sbtc-to-stx.mjs
 *   node tools/swap-sbtc-to-stx.mjs --accounts 50 --slippage 0.5
 *   node tools/swap-sbtc-to-stx.mjs --dry-run
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { generateWallet, generateNewAccount, getStxAddress } from "@stacks/wallet-sdk";
import stxTx from "@stacks/transactions";
const {
  makeContractCall,
  broadcastTransaction,
  getAddressFromPrivateKey,
  contractPrincipalCV,
  uintCV,
  serializeCV,
  hexToCV,
  PostConditionMode,
} = stxTx;
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";

// ── Config ──────────────────────────────────────────────────────────────────

const NETWORK = "mainnet";
const API_BASE = "https://api.mainnet.hiro.so";
const HIRO_RO_API = "https://api.hiro.so";
const DEFAULT_NUM_ACCOUNTS = 33;
const DEFAULT_SLIPPAGE = 0.1; // 0.1%
const TX_FEE = 2000n; // 0.002 STX — contract call fee
const EXPLORER = "https://explorer.hiro.so/txid";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

// ── Contracts ───────────────────────────────────────────────────────────────

const XYK_CORE = {
  address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR",
  name: "xyk-core-v-1-2",
};
const POOL_SBTC_STX = {
  address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR",
  name: "xyk-pool-sbtc-stx-v-1-1",
};
const SBTC = {
  address: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4",
  name: "sbtc-token",
};
const WSTX = {
  address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR",
  name: "token-stx-v-1-2",
};
const SBTC_CONTRACT_ID = `${SBTC.address}.${SBTC.name}::sbtc-token`;

// ── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flagVal = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};
const hasFlag = (name) => args.includes(name);

const NUM_ACCOUNTS = parseInt(flagVal("--accounts") ?? String(DEFAULT_NUM_ACCOUNTS), 10);
const SLIPPAGE = parseFloat(flagVal("--slippage") ?? String(DEFAULT_SLIPPAGE));
const DRY_RUN = hasFlag("--dry-run");
```

- [ ] **Step 2: Verify the file is syntactically valid**

```bash
node --input-type=module < tools/swap-sbtc-to-stx.mjs 2>&1 | head -5
```

Expected: no output (script starts but exits immediately — no `main()` yet). Any `SyntaxError` here means fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add tools/swap-sbtc-to-stx.mjs
git commit -m "feat(tools): scaffold swap-sbtc-to-stx with constants and imports"
```

---

### Task 2: Helper functions

**Files:**
- Modify: `tools/swap-sbtc-to-stx.mjs`

- [ ] **Step 1: Append helper functions after the Args section**

```javascript
// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatSbtc(sats) {
  return (Number(sats) / 1e8).toFixed(8);
}

function formatStx(micro) {
  return (Number(micro) / 1e6).toFixed(6);
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function cvToHex(cv) {
  const result = serializeCV(cv);
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result).toString("hex");
}

// Derive STX accounts using Xverse-style BIP44 path: m/44'/5757'/{accountIndex}'/0/0
function deriveXverseAccounts(mnemonic, numAccounts) {
  const seed = mnemonicToSeedSync(mnemonic.trim());
  const rootNode = HDKey.fromMasterSeed(seed);
  const accounts = [];
  for (let i = 0; i < numAccounts; i++) {
    const path = `m/44'/5757'/${i}'/0/0`;
    const childKey = rootNode.derive(path);
    const privKeyHex = Buffer.from(childKey.privateKey).toString("hex") + "01";
    const address = getAddressFromPrivateKey(privKeyHex);
    accounts.push({ index: i, address, stxPrivateKey: privKeyHex });
  }
  return accounts;
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --input-type=module < tools/swap-sbtc-to-stx.mjs 2>&1 | head -5
```

Expected: no output (no `main()` yet, no errors).

- [ ] **Step 3: Commit**

```bash
git add tools/swap-sbtc-to-stx.mjs
git commit -m "feat(tools): add helper functions to swap-sbtc-to-stx"
```

---

### Task 3: Balance fetching

**Files:**
- Modify: `tools/swap-sbtc-to-stx.mjs`

- [ ] **Step 1: Append balance fetch functions**

```javascript
// ── Balance Fetching ─────────────────────────────────────────────────────────

async function fetchSbtcBalance(address, retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${API_BASE}/extended/v1/address/${address}/balances`);
    if (res.status === 429 || res.status === 503) {
      const wait = 5000 + attempt * 3000;
      process.stdout.write(`  ⏳ rate limited, retry ${attempt}/${retries} — waiting ${wait / 1000}s...    \r`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`API error ${res.status} for ${address}`);
    const data = await res.json();
    const ft = data.fungible_tokens?.[SBTC_CONTRACT_ID];
    return ft ? BigInt(ft.balance) : 0n;
  }
  throw new Error(`API rate limited after ${retries} retries for ${address}`);
}

async function fetchStxBalance(address, retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${API_BASE}/extended/v1/address/${address}/stx`);
    if (res.status === 429 || res.status === 503) {
      const wait = 5000 + attempt * 3000;
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`API error ${res.status} for ${address}`);
    const data = await res.json();
    return BigInt(data.balance) - BigInt(data.locked);
  }
  throw new Error(`API rate limited after ${retries} retries for ${address}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/swap-sbtc-to-stx.mjs
git commit -m "feat(tools): add balance fetching to swap-sbtc-to-stx"
```

---

### Task 4: Quote fetching via read-only contract call

**Files:**
- Modify: `tools/swap-sbtc-to-stx.mjs`

- [ ] **Step 1: Append quote fetch function**

```javascript
// ── Quote Fetching ───────────────────────────────────────────────────────────

async function fetchSwapQuote(sbtcAmountSats, retries = 6) {
  const args = [
    cvToHex(contractPrincipalCV(POOL_SBTC_STX.address, POOL_SBTC_STX.name)),
    cvToHex(contractPrincipalCV(SBTC.address, SBTC.name)),
    cvToHex(contractPrincipalCV(WSTX.address, WSTX.name)),
    cvToHex(uintCV(sbtcAmountSats)),
  ];

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(
      `${HIRO_RO_API}/v2/contracts/call-read/${XYK_CORE.address}/${XYK_CORE.name}/get-dy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
      }
    );
    if (res.status === 429 || res.status === 503) {
      const wait = 5000 + attempt * 3000;
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`Quote API error ${res.status}`);
    const data = await res.json();
    if (!data.okay) throw new Error(`get-dy failed: ${data.cause ?? "unknown"}`);

    const cv = hexToCV(data.result);
    // (ok uint) — unwrap
    // eslint-disable-next-line no-prototype-builtins
    const raw = cv;
    let stxOut;
    if (raw.type === "ok") {
      stxOut = BigInt(raw.value?.value ?? raw.value ?? 0);
    } else if (typeof raw.type === "number" && raw.type === 7 /* ResponseOk */) {
      stxOut = BigInt(raw.value?.value ?? 0);
    } else {
      throw new Error(`Unexpected CV type from get-dy: ${JSON.stringify(raw)}`);
    }
    return stxOut;
  }
  throw new Error(`Quote rate limited after ${retries} retries`);
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/swap-sbtc-to-stx.mjs
git commit -m "feat(tools): add XYK read-only quote fetching to swap-sbtc-to-stx"
```

---

### Task 5: Scan phase — balance loop, table display, summary

**Files:**
- Modify: `tools/swap-sbtc-to-stx.mjs`

- [ ] **Step 1: Append the main() function with scan phase**

```javascript
// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log("\n========================================");
  console.log("  sBTC → STX Swap Tool — Mainnet");
  console.log("========================================");
  console.log(`  XYK Pool  : ${POOL_SBTC_STX.address}.${POOL_SBTC_STX.name}`);
  console.log(`  Accounts  : ${NUM_ACCOUNTS}`);
  console.log(`  Slippage  : ${SLIPPAGE}%`);
  console.log(`  Dry run   : ${DRY_RUN ? "YES" : "no"}`);
  console.log(`  Tx fee    : ${formatStx(TX_FEE)} STX (per swap)`);
  console.log("========================================\n");

  // 1. Get mnemonic
  const mnemonic = await rl.question("Enter your mnemonic (12 or 24 words): ");
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    console.error("❌ Invalid mnemonic — expected 12 or 24 words.");
    rl.close();
    process.exit(1);
  }

  const is12Word = words.length === 12;

  // 2. Derive wallet
  console.log("\nDeriving wallet...");
  let derivedAccounts;

  if (is12Word) {
    console.log("  Mode: Xverse (BIP44 account-level derivation)");
    derivedAccounts = deriveXverseAccounts(mnemonic, NUM_ACCOUNTS);
  } else {
    console.log("  Mode: Leather (wallet-sdk derivation)");
    let wallet = await generateWallet({ secretKey: mnemonic.trim(), password: "" });
    for (let i = 1; i < NUM_ACCOUNTS; i++) {
      wallet = generateNewAccount(wallet);
    }
    derivedAccounts = wallet.accounts.map((account, i) => ({
      index: i,
      address: getStxAddress(account, NETWORK),
      stxPrivateKey: account.stxPrivateKey,
    }));
  }

  console.log(`✓ Derived ${derivedAccounts.length} accounts\n`);

  // 3. Scan balances + fetch quotes
  console.log("Scanning sBTC balances and fetching quotes...\n");
  console.log("  #   Address          sBTC In           STX Out (est.)    STX Balance");
  console.log("  ─── ──────────────── ──────────────── ──────────────── ──────────────");

  const swappable = [];
  let totalSbtcIn = 0n;
  let totalStxOut = 0n;
  let lowFeeAccounts = 0;

  for (const { index, address, stxPrivateKey } of derivedAccounts) {
    const sbtcBalance = await fetchSbtcBalance(address);
    await sleep(400);
    const stxBalance = await fetchStxBalance(address);

    const hasFee = stxBalance >= TX_FEE;
    const hasSbtc = sbtcBalance > 0n;

    let stxOutEst = 0n;
    let estStr = "                ";

    if (hasSbtc && hasFee) {
      await sleep(400);
      try {
        stxOutEst = await fetchSwapQuote(sbtcBalance);
        estStr = formatStx(stxOutEst).padStart(16);
      } catch {
        estStr = "   (quote error)";
      }
      swappable.push({ index, address, stxPrivateKey, sbtcBalance, stxOutEst });
      totalSbtcIn += sbtcBalance;
      totalStxOut += stxOutEst;
    } else if (hasSbtc && !hasFee) {
      lowFeeAccounts++;
    }

    const feeWarning = hasSbtc && !hasFee ? " ⚠ low STX" : "";
    console.log(
      `  ${String(index).padStart(3)}  ${shortAddr(address).padEnd(14)}  ${formatSbtc(sbtcBalance).padStart(16)}  ${estStr}  ${formatStx(stxBalance).padStart(14)}${feeWarning}`
    );

    await sleep(800);
  }

  console.log("\n────────────────────────────────────────────────────────────────");
  console.log(`  Accounts to swap    : ${swappable.length}`);
  console.log(`  Total sBTC in       : ${formatSbtc(totalSbtcIn)} sBTC`);
  console.log(`  Total STX out (est.): ~${formatStx(totalStxOut)} STX`);
  console.log(`  Total fees          : ${formatStx(TX_FEE * BigInt(swappable.length))} STX`);
  if (lowFeeAccounts > 0) {
    console.log(`  ⚠ Skipped (low STX) : ${lowFeeAccounts} accounts — need ${formatStx(TX_FEE)} STX for fee`);
  }
  console.log("────────────────────────────────────────────────────────────────\n");

  if (swappable.length === 0) {
    console.log("Nothing to swap.");
    rl.close();
    return;
  }

  if (DRY_RUN) {
    console.log("🏁 Dry run complete — no transactions sent.");
    rl.close();
    return;
  }

  // 4. Confirm
  const confirm = await rl.question(
    `Swap ${formatSbtc(totalSbtcIn)} sBTC across ${swappable.length} account(s)? (yes/no): `
  );
  if (confirm.trim().toLowerCase() !== "yes") {
    console.log("Cancelled.");
    rl.close();
    return;
  }

  rl.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Test dry-run (no mnemonic sent, just verify it starts)**

```bash
echo "" | node tools/swap-sbtc-to-stx.mjs --dry-run --accounts 1 2>&1 | head -15
```

Expected output should include:
```
========================================
  sBTC → STX Swap Tool — Mainnet
========================================
```
No `SyntaxError` or `ReferenceError`.

- [ ] **Step 3: Commit**

```bash
git add tools/swap-sbtc-to-stx.mjs
git commit -m "feat(tools): add scan phase and main() to swap-sbtc-to-stx"
```

---

### Task 6: Swap execution phase

**Files:**
- Modify: `tools/swap-sbtc-to-stx.mjs`

- [ ] **Step 1: Add the swap execution block inside `main()`, after the confirm block (replace the closing `rl.close()` comment placeholder)**

Locate this block in `main()`:
```javascript
  if (confirm.trim().toLowerCase() !== "yes") {
    console.log("Cancelled.");
    rl.close();
    return;
  }

  rl.close();
}
```

Replace it with:
```javascript
  if (confirm.trim().toLowerCase() !== "yes") {
    console.log("Cancelled.");
    rl.close();
    return;
  }

  rl.close();

  // 5. Execute swaps
  console.log("\nSending transactions...\n");

  let success = 0;
  let failed = 0;

  for (const { index, address, stxPrivateKey, sbtcBalance, stxOutEst } of swappable) {
    process.stdout.write(
      `  [${index}] ${shortAddr(address)} → ${formatSbtc(sbtcBalance)} sBTC → ~${formatStx(stxOutEst)} STX ... `
    );

    // minAmountOut = quote * (1 - slippage/100), floor to BigInt
    const minAmountOut = BigInt(Math.floor(Number(stxOutEst) * (1 - SLIPPAGE / 100)));

    let sent = false;
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        const tx = await makeContractCall({
          contractAddress: XYK_CORE.address,
          contractName: XYK_CORE.name,
          functionName: "swap-x-for-y",
          functionArgs: [
            contractPrincipalCV(POOL_SBTC_STX.address, POOL_SBTC_STX.name),
            contractPrincipalCV(SBTC.address, SBTC.name),
            contractPrincipalCV(WSTX.address, WSTX.name),
            uintCV(sbtcBalance),
            uintCV(minAmountOut),
          ],
          senderKey: stxPrivateKey,
          fee: TX_FEE,
          postConditionMode: PostConditionMode.Allow,
          network: NETWORK,
        });

        const result = await broadcastTransaction({ transaction: tx, network: NETWORK });

        if ("error" in result) {
          console.log(`❌ ${result.reason}`);
          failed++;
        } else {
          console.log(`✓ ${result.txid}`);
          success++;
        }
        sent = true;
        break;
      } catch (err) {
        if ((err.message.includes("429") || err.message.includes("503")) && attempt < 8) {
          const wait = 5000 + attempt * 5000;
          process.stdout.write(`⏳ 429, retry ${attempt}/8 in ${wait / 1000}s...    \r`);
          await sleep(wait);
          process.stdout.write(
            `  [${index}] ${shortAddr(address)} → ${formatSbtc(sbtcBalance)} sBTC → ~${formatStx(stxOutEst)} STX ... `
          );
        } else {
          console.log(`❌ ${err.message.slice(0, 80)}`);
          failed++;
          sent = true;
          break;
        }
      }
    }

    if (!sent) {
      console.log(`❌ failed after retries`);
      failed++;
    }

    await sleep(3000);
  }

  // 6. Summary
  console.log("\n========================================");
  console.log(`  Done! ${success} sent, ${failed} failed`);
  console.log(`  Total sBTC swapped : ~${formatSbtc(totalSbtcIn)} sBTC`);
  console.log(`  Total STX received : ~${formatStx(totalStxOut)} STX (estimated)`);
  console.log(`  Explorer: ${EXPLORER}/<txid>?chain=mainnet`);
  console.log("========================================\n");
}
```

- [ ] **Step 2: Verify final syntax**

```bash
node --check tools/swap-sbtc-to-stx.mjs && echo "✓ syntax OK"
```

Expected: `✓ syntax OK`

- [ ] **Step 3: Commit**

```bash
git add tools/swap-sbtc-to-stx.mjs
git commit -m "feat(tools): add swap execution phase to swap-sbtc-to-stx"
```

---

### Task 7: End-to-end dry-run verification

**Files:**
- No changes — verification only

- [ ] **Step 1: Run with `--dry-run --accounts 1` and a known test mnemonic**

This step only works if you have a real test mnemonic. If you do, run:

```bash
node tools/swap-sbtc-to-stx.mjs --dry-run --accounts 1
```

Then enter your 12 or 24-word mnemonic at the prompt.

Expected output:
```
========================================
  sBTC → STX Swap Tool — Mainnet
========================================
  XYK Pool  : SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1
  Accounts  : 1
  Slippage  : 0.1%
  Dry run   : YES
  Tx fee    : 0.002000 STX (per swap)
========================================

Deriving wallet...
  Mode: Xverse (BIP44 account-level derivation)   ← or Leather
✓ Derived 1 accounts

Scanning sBTC balances and fetching quotes...

  #   Address          sBTC In           STX Out (est.)    STX Balance
  ─── ──────────────── ──────────────── ──────────────── ──────────────
  ...

🏁 Dry run complete — no transactions sent.
```

- [ ] **Step 2: Verify `--accounts` and `--slippage` flags override defaults**

```bash
echo "invalid" | node tools/swap-sbtc-to-stx.mjs --accounts 2 --slippage 0.5 2>&1 | grep -E "Accounts|Slippage|Invalid"
```

Expected output includes:
```
  Accounts  : 2
  Slippage  : 0.5%
```
And after entering "invalid" mnemonic:
```
❌ Invalid mnemonic — expected 12 or 24 words.
```

- [ ] **Step 3: Final commit**

```bash
git add tools/swap-sbtc-to-stx.mjs
git commit -m "feat(tools): complete swap-sbtc-to-stx CLI tool"
```
