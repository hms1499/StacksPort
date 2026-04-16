# DCA Vault V2 CLI Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `tools/dca-v2.mjs` — a single-command CLI tool covering the full dca-vault-v2 lifecycle: create plan, execute swap, cancel/refund. Each derived account signs its own transactions.

**Architecture:** Single `.mjs` file with 3 subcommands (`create`, `execute`, `cancel`). Reuses the same wallet derivation, retry, and nonce patterns as existing tools (`swap-sbtc-to-stx.mjs`, `cancel-dca-plans.mjs`). Each account signs its own tx using its private key.

**Tech Stack:** Node.js ESM, `@stacks/transactions` v7, `@stacks/wallet-sdk`, `@stacks/network`, `@scure/bip32`, `@scure/bip39`

**Spec:** `docs/superpowers/specs/2026-04-13-dca-v2-cli-tool-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `tools/dca-v2.mjs` | Complete CLI tool — imports, constants, helpers, wallet derivation, API helpers, 3 command handlers, main dispatcher |

---

### Task 1: Scaffold file — imports, constants, args, helpers

**Files:**
- Create: `tools/dca-v2.mjs`

- [ ] **Step 1: Create the file with shebang, imports, constants, arg parsing, and shared helpers**

Create `tools/dca-v2.mjs`:

```javascript
#!/usr/bin/env node

/**
 * DCA Vault V2 CLI Tool
 * Full lifecycle: create plan, execute swap, cancel/refund.
 *
 * Usage:
 *   node tools/dca-v2.mjs create --amount 2 --interval daily --deposit 10
 *   node tools/dca-v2.mjs execute --slippage 0.1
 *   node tools/dca-v2.mjs cancel
 *
 * Shared flags:
 *   --accounts <n>   Number of accounts to derive (default: 40)
 *   --dry-run        Scan only, no transactions broadcast
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { generateWallet, generateNewAccount, getStxAddress } from "@stacks/wallet-sdk";
import stxTx from "@stacks/transactions";
const {
  makeContractCall,
  broadcastTransaction,
  getAddressFromPrivateKey,
  standardPrincipalCV,
  contractPrincipalCV,
  uintCV,
  serializeCV,
  hexToCV,
  fetchNonce,
  PostConditionMode,
} = stxTx;
import { STACKS_MAINNET } from "@stacks/network";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";

// ── Config ──────────────────────────────────────────────────────────────────

const NETWORK = "mainnet";
const API_BASE = "https://api.mainnet.hiro.so";
const HIRO_RO_API = "https://api.hiro.so";
const DEFAULT_NUM_ACCOUNTS = 40;
const DEFAULT_SLIPPAGE = 0.1; // 0.1%
const TX_FEE = 2000n; // 0.002 STX
const EXPLORER = "https://explorer.hiro.so/txid";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

// ── DCA Vault V2 Contract ───────────────────────────────────────────────────

const DCA_VAULT = {
  address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV",
  name: "dca-vault-v2",
};
const SWAP_ROUTER = {
  address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV",
  name: "bitflow-sbtc-swap-router",
};
const SBTC = {
  address: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4",
  name: "sbtc-token",
};

// ── XYK Pool (for execute quote) ────────────────────────────────────────────

const XYK_CORE = {
  address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR",
  name: "xyk-core-v-1-2",
};
const POOL_SBTC_STX = {
  address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR",
  name: "xyk-pool-sbtc-stx-v-1-1",
};
const WSTX = {
  address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR",
  name: "token-stx-v-1-2",
};

// ── Intervals ───────────────────────────────────────────────────────────────

const INTERVALS = {
  daily: 144,
  weekly: 1008,
  monthly: 4320,
};

// ── Args ────────────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const COMMAND = rawArgs[0]; // create | execute | cancel
const flags = rawArgs.slice(1);
const flagVal = (name) => {
  const i = flags.indexOf(name);
  return i !== -1 && flags[i + 1] ? flags[i + 1] : null;
};
const hasFlag = (name) => flags.includes(name);

const NUM_ACCOUNTS = parseInt(flagVal("--accounts") ?? String(DEFAULT_NUM_ACCOUNTS), 10);
const DRY_RUN = hasFlag("--dry-run");

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatStx(micro) {
  return (Number(micro) / 1e6).toFixed(6);
}

function formatSbtc(sats) {
  return (Number(sats) / 1e8).toFixed(8);
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function cvToHex(cv) {
  const result = serializeCV(cv);
  if (typeof result === "string") return result;
  return Buffer.from(result).toString("hex");
}

function intervalName(blocks) {
  for (const [name, val] of Object.entries(INTERVALS)) {
    if (val === blocks) return name;
  }
  return `${blocks} blocks`;
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check tools/dca-v2.mjs && echo "syntax OK"
```

Expected: `syntax OK`

- [ ] **Step 3: Commit**

```bash
git add tools/dca-v2.mjs
git commit -m "feat(tools): scaffold dca-v2 CLI with imports, constants, args"
```

---

### Task 2: Wallet derivation and API helpers

**Files:**
- Modify: `tools/dca-v2.mjs`

- [ ] **Step 1: Append wallet derivation function after helpers section**

```javascript
// ── Wallet Derivation ───────────────────────────────────────────────────────

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

async function deriveAccounts(mnemonic, numAccounts) {
  const words = mnemonic.trim().split(/\s+/);
  if (words.length === 12) {
    console.log("  Mode: Xverse (BIP44 account-level derivation)");
    return deriveXverseAccounts(mnemonic, numAccounts);
  }
  console.log("  Mode: Leather (wallet-sdk derivation)");
  let wallet = await generateWallet({ secretKey: mnemonic.trim(), password: "" });
  for (let i = 1; i < numAccounts; i++) {
    wallet = generateNewAccount(wallet);
  }
  return wallet.accounts.map((account, i) => ({
    index: i,
    address: getStxAddress(account, NETWORK),
    stxPrivateKey: account.stxPrivateKey,
  }));
}
```

- [ ] **Step 2: Append API helpers with retry logic**

```javascript
// ── API Helpers ─────────────────────────────────────────────────────────────

async function fetchWithRetry(url, options, retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch {
      await sleep(5000 + attempt * 3000);
      continue;
    }
    if (res.status === 429 || res.status === 503 || res.status === 522) {
      const wait = 5000 + attempt * 3000;
      process.stdout.write(`  rate limited, retry ${attempt}/${retries} — ${wait / 1000}s...\r`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      await sleep(5000 + attempt * 3000);
      continue;
    }
    try {
      return await res.json();
    } catch {
      await sleep(5000 + attempt * 3000);
      continue;
    }
  }
  return null;
}

async function fetchNonceWithRetry(address, retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchNonce({ address, network: STACKS_MAINNET });
    } catch (err) {
      const is429 = err.message?.includes("429") || err.message?.includes("rate limit");
      if (!is429 || attempt === retries) throw err;
      const wait = 30000 + attempt * 5000;
      process.stdout.write(`  nonce 429 retry ${attempt}/${retries} — ${wait / 1000}s...\r`);
      await sleep(wait);
    }
  }
}

async function fetchStxBalance(address) {
  const data = await fetchWithRetry(`${API_BASE}/extended/v1/address/${address}/stx`);
  if (!data) return 0n;
  return BigInt(data.balance) - BigInt(data.locked);
}

async function readOnly(fn, args = []) {
  const data = await fetchWithRetry(
    `${HIRO_RO_API}/v2/contracts/call-read/${DCA_VAULT.address}/${DCA_VAULT.name}/${fn}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
    }
  );
  if (!data?.okay) return null;
  return hexToCV(data.result);
}

async function fetchUserPlans(address) {
  const cv = await readOnly("get-user-plans", [cvToHex(standardPrincipalCV(address))]);
  if (!cv || !Array.isArray(cv.value)) return [];
  return cv.value.map((v) => Number(v.value));
}

async function fetchPlan(planId) {
  const cv = await readOnly("get-plan", [cvToHex(uintCV(planId))]);
  if (!cv) return null;
  const d = cv.value?.data ?? cv.value?.value;
  if (!d) return null;
  return {
    id: planId,
    active: d.active?.type === "true" || d.active?.type === "bool-true" || d.active === true,
    bal: BigInt(d.bal?.value ?? 0),
    amt: BigInt(d.amt?.value ?? 0),
    ivl: Number(d.ivl?.value ?? 0),
    tsd: Number(d.tsd?.value ?? 0),
    tss: BigInt(d.tss?.value ?? 0),
    leb: Number(d.leb?.value ?? 0),
  };
}

async function canExecute(planId) {
  const cv = await readOnly("can-execute", [cvToHex(uintCV(planId))]);
  if (!cv) return false;
  return cv.type === "true" || cv.type === "bool-true";
}

// Quote: DCA swaps STX→sBTC = swap-y-for-x on pool (x=sBTC, y=wSTX)
// get-dx: input y-amount (uSTX), output x-amount (sBTC sats)
async function fetchSwapQuote(stxAmountMicro) {
  const callArgs = [
    cvToHex(contractPrincipalCV(POOL_SBTC_STX.address, POOL_SBTC_STX.name)),
    cvToHex(contractPrincipalCV(SBTC.address, SBTC.name)),
    cvToHex(contractPrincipalCV(WSTX.address, WSTX.name)),
    cvToHex(uintCV(stxAmountMicro)),
  ];

  const data = await fetchWithRetry(
    `${HIRO_RO_API}/v2/contracts/call-read/${XYK_CORE.address}/${XYK_CORE.name}/get-dx`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: callArgs }),
    }
  );
  if (!data?.okay) throw new Error(`get-dx failed: ${data?.cause ?? "unknown"}`);

  const cv = hexToCV(data.result);
  if (cv.type === "ok" || (typeof cv.type === "number" && cv.type === 7)) {
    return BigInt(cv.value?.value ?? cv.value ?? 0);
  }
  throw new Error(`Unexpected CV type from get-dx: ${JSON.stringify(cv)}`);
}
```

- [ ] **Step 3: Verify syntax**

```bash
node --check tools/dca-v2.mjs && echo "syntax OK"
```

Expected: `syntax OK`

- [ ] **Step 4: Commit**

```bash
git add tools/dca-v2.mjs
git commit -m "feat(tools): add wallet derivation and API helpers to dca-v2"
```

---

### Task 3: `create` command handler

**Files:**
- Modify: `tools/dca-v2.mjs`

- [ ] **Step 1: Append the create command handler**

```javascript
// ── Commands ────────────────────────────────────────────────────────────────

async function cmdCreate(rl, accounts) {
  const amountStx = parseFloat(flagVal("--amount") ?? "0");
  const intervalKey = (flagVal("--interval") ?? "").toLowerCase();
  const depositStx = parseFloat(flagVal("--deposit") ?? "0");

  if (!amountStx || !intervalKey || !depositStx) {
    console.error("Usage: node tools/dca-v2.mjs create --amount <STX> --interval <daily|weekly|monthly> --deposit <STX>");
    process.exit(1);
  }

  const intervalBlocks = INTERVALS[intervalKey];
  if (!intervalBlocks) {
    console.error(`Invalid interval: ${intervalKey}. Use: daily, weekly, monthly`);
    process.exit(1);
  }

  const amountMicro = BigInt(Math.floor(amountStx * 1e6));
  const depositMicro = BigInt(Math.floor(depositStx * 1e6));

  // Contract validations
  if (amountMicro < 1_000_000n) {
    console.error("Amount must be >= 1 STX");
    process.exit(1);
  }
  if (depositMicro < 2_000_000n) {
    console.error("Deposit must be >= 2 STX");
    process.exit(1);
  }
  if (depositMicro < amountMicro) {
    console.error("Deposit must be >= amount per swap");
    process.exit(1);
  }

  console.log(`\n  Action      : CREATE plan`);
  console.log(`  Target      : sBTC (${SBTC.address}.${SBTC.name})`);
  console.log(`  Amount/swap : ${amountStx} STX (${amountMicro} uSTX)`);
  console.log(`  Interval    : ${intervalKey} (${intervalBlocks} blocks)`);
  console.log(`  Deposit     : ${depositStx} STX (${depositMicro} uSTX)`);
  console.log(`  Tx fee      : ${formatStx(TX_FEE)} STX per tx\n`);

  // Scan balances
  console.log("  Scanning STX balances...\n");
  console.log("  #   Address          STX Balance       Status");
  console.log("  --- ---------------- ---------------- --------");

  const eligible = [];
  const needed = depositMicro + TX_FEE;

  for (const acct of accounts) {
    const bal = await fetchStxBalance(acct.address);
    const ok = bal >= needed;
    const status = ok ? "OK" : "LOW";
    if (ok) eligible.push({ ...acct, bal });

    console.log(
      `  ${String(acct.index).padStart(3)}  ${shortAddr(acct.address).padEnd(16)} ${formatStx(bal).padStart(16)}  ${status}`
    );
    await sleep(500);
  }

  console.log(`\n  Eligible: ${eligible.length} / ${accounts.length} accounts`);
  console.log(`  Total deposit: ${formatStx(depositMicro * BigInt(eligible.length))} STX`);
  console.log(`  Total fees   : ${formatStx(TX_FEE * BigInt(eligible.length))} STX\n`);

  if (eligible.length === 0) {
    console.log("  No accounts with sufficient balance.");
    return;
  }

  if (DRY_RUN) {
    console.log("  Dry run complete — no transactions sent.");
    return;
  }

  const answer = await rl.question(`  Create ${eligible.length} plan(s)? (yes/no): `);
  if (answer.trim().toLowerCase() !== "yes") {
    console.log("  Cancelled.");
    return;
  }

  // Broadcast
  console.log("\n  Creating plans...\n");
  let success = 0;
  let failed = 0;

  for (const { index, address, stxPrivateKey } of eligible) {
    const label = `  [${String(index).padStart(3)}] ${shortAddr(address)}`;
    try {
      const nonce = await fetchNonceWithRetry(address);
      const tx = await makeContractCall({
        contractAddress: DCA_VAULT.address,
        contractName: DCA_VAULT.name,
        functionName: "create-plan",
        functionArgs: [
          contractPrincipalCV(SBTC.address, SBTC.name),
          uintCV(amountMicro),
          uintCV(intervalBlocks),
          uintCV(depositMicro),
        ],
        senderKey: stxPrivateKey,
        network: STACKS_MAINNET,
        fee: TX_FEE,
        nonce,
        postConditionMode: PostConditionMode.Allow,
      });

      const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
      if (result.error) {
        console.log(`${label}  FAIL  ${result.error}: ${result.reason ?? ""}`);
        failed++;
      } else {
        const txid = typeof result === "string" ? result : result.txid;
        console.log(`${label}  OK    tx: ${txid}`);
        success++;
      }
    } catch (err) {
      console.log(`${label}  FAIL  ${err.message}`);
      failed++;
    }
    await sleep(1500);
  }

  console.log(`\n  Done! Success: ${success}  Failed: ${failed}  Total: ${eligible.length}`);
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check tools/dca-v2.mjs && echo "syntax OK"
```

Expected: `syntax OK`

- [ ] **Step 3: Commit**

```bash
git add tools/dca-v2.mjs
git commit -m "feat(tools): add create command to dca-v2"
```

---

### Task 4: `execute` command handler

**Files:**
- Modify: `tools/dca-v2.mjs`

- [ ] **Step 1: Append the execute command handler after `cmdCreate`**

```javascript
async function cmdExecute(rl, accounts) {
  const SLIPPAGE = parseFloat(flagVal("--slippage") ?? String(DEFAULT_SLIPPAGE));

  console.log(`\n  Action   : EXECUTE eligible plans`);
  console.log(`  Slippage : ${SLIPPAGE}%`);
  console.log(`  Tx fee   : ${formatStx(TX_FEE)} STX per tx\n`);

  // Scan each account for executable plans
  console.log("  Scanning accounts for executable plans...\n");
  console.log("  #   Address          Plan  Amt/Swap         Balance          sBTC Out (est.)");
  console.log("  --- ---------------- ----- ---------------- ---------------- ----------------");

  const executable = []; // { account, planId, amt, sbtcOut }

  for (const acct of accounts) {
    const planIds = await fetchUserPlans(acct.address);
    if (planIds.length === 0) continue;

    for (const planId of planIds) {
      const ok = await canExecute(planId);
      if (!ok) continue;

      const plan = await fetchPlan(planId);
      if (!plan) continue;

      // Fetch quote: amt is uSTX per swap, deduct 0.3% protocol fee
      const protocolFee = plan.amt * 30n / 10000n;
      const netSwap = plan.amt - protocolFee;
      let sbtcOut = 0n;
      let estStr = "  (quote error)  ";

      try {
        await sleep(400);
        sbtcOut = await fetchSwapQuote(netSwap);
        estStr = formatSbtc(sbtcOut).padStart(16);
      } catch {
        // keep estStr as error
      }

      executable.push({ ...acct, planId, amt: plan.amt, bal: plan.bal, sbtcOut });

      console.log(
        `  ${String(acct.index).padStart(3)}  ${shortAddr(acct.address).padEnd(16)} ${String(planId).padStart(5)} ${formatStx(plan.amt).padStart(16)} ${formatStx(plan.bal).padStart(16)} ${estStr}`
      );

      await sleep(500);
    }
    await sleep(500);
  }

  console.log(`\n  Executable plans: ${executable.length}`);
  console.log(`  Total fees      : ${formatStx(TX_FEE * BigInt(executable.length))} STX\n`);

  if (executable.length === 0) {
    console.log("  No plans eligible for execution.");
    return;
  }

  if (DRY_RUN) {
    console.log("  Dry run complete — no transactions sent.");
    return;
  }

  const answer = await rl.question(`  Execute ${executable.length} plan(s)? (yes/no): `);
  if (answer.trim().toLowerCase() !== "yes") {
    console.log("  Cancelled.");
    return;
  }

  // Broadcast
  console.log("\n  Executing swaps...\n");
  let success = 0;
  let failed = 0;

  // Group by address for nonce sequencing
  const byAddress = new Map();
  for (const item of executable) {
    if (!byAddress.has(item.address)) byAddress.set(item.address, []);
    byAddress.get(item.address).push(item);
  }

  for (const [address, items] of byAddress) {
    let nonce;
    try {
      nonce = await fetchNonceWithRetry(address);
    } catch (err) {
      console.log(`  ${shortAddr(address)} — nonce error: ${err.message}`);
      failed += items.length;
      continue;
    }

    for (const { index, stxPrivateKey, planId, sbtcOut } of items) {
      const label = `  [${String(index).padStart(3)}] ${shortAddr(address)} plan #${planId}`;

      // min-amount-out with slippage
      const minOut = sbtcOut > 0n
        ? (sbtcOut * BigInt(Math.floor((1 - SLIPPAGE / 100) * 10000))) / 10000n
        : 0n;

      try {
        const tx = await makeContractCall({
          contractAddress: DCA_VAULT.address,
          contractName: DCA_VAULT.name,
          functionName: "execute-dca",
          functionArgs: [
            uintCV(planId),
            contractPrincipalCV(SWAP_ROUTER.address, SWAP_ROUTER.name),
            uintCV(minOut),
          ],
          senderKey: stxPrivateKey,
          network: STACKS_MAINNET,
          fee: TX_FEE,
          nonce,
          postConditionMode: PostConditionMode.Allow,
        });

        const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
        if (result.error) {
          console.log(`${label}  FAIL  ${result.error}: ${result.reason ?? ""}`);
          failed++;
        } else {
          const txid = typeof result === "string" ? result : result.txid;
          console.log(`${label}  OK    tx: ${txid}`);
          success++;
          nonce++;
        }
      } catch (err) {
        console.log(`${label}  FAIL  ${err.message}`);
        failed++;
      }
      await sleep(1500);
    }
    await sleep(1000);
  }

  console.log(`\n  Done! Success: ${success}  Failed: ${failed}  Total: ${executable.length}`);
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check tools/dca-v2.mjs && echo "syntax OK"
```

Expected: `syntax OK`

- [ ] **Step 3: Commit**

```bash
git add tools/dca-v2.mjs
git commit -m "feat(tools): add execute command to dca-v2"
```

---

### Task 5: `cancel` command handler

**Files:**
- Modify: `tools/dca-v2.mjs`

- [ ] **Step 1: Append the cancel command handler after `cmdExecute`**

```javascript
async function cmdCancel(rl, accounts) {
  console.log(`\n  Action : CANCEL active plans (refund remaining balance)`);
  console.log(`  Tx fee : ${formatStx(TX_FEE)} STX per tx\n`);

  // Scan for active plans
  console.log("  Scanning accounts for active plans...\n");
  console.log("  #   Address          Plan  Balance          Swaps Done");
  console.log("  --- ---------------- ----- ---------------- ----------");

  const cancellable = []; // { account, planId, bal }
  let totalRefund = 0n;

  for (const acct of accounts) {
    const planIds = await fetchUserPlans(acct.address);
    if (planIds.length === 0) continue;

    for (const planId of planIds) {
      const plan = await fetchPlan(planId);
      if (!plan || !plan.active) continue;

      cancellable.push({ ...acct, planId, bal: plan.bal, tsd: plan.tsd });
      totalRefund += plan.bal;

      console.log(
        `  ${String(acct.index).padStart(3)}  ${shortAddr(acct.address).padEnd(16)} ${String(planId).padStart(5)} ${formatStx(plan.bal).padStart(16)} ${String(plan.tsd).padStart(10)}`
      );
      await sleep(500);
    }
    await sleep(500);
  }

  console.log(`\n  Active plans  : ${cancellable.length}`);
  console.log(`  Total refund  : ${formatStx(totalRefund)} STX`);
  console.log(`  Total fees    : ${formatStx(TX_FEE * BigInt(cancellable.length))} STX\n`);

  if (cancellable.length === 0) {
    console.log("  No active plans found.");
    return;
  }

  if (DRY_RUN) {
    console.log("  Dry run complete — no transactions sent.");
    return;
  }

  const answer = await rl.question(`  Cancel ${cancellable.length} plan(s) and refund ${formatStx(totalRefund)} STX? (yes/no): `);
  if (answer.trim().toLowerCase() !== "yes") {
    console.log("  Cancelled.");
    return;
  }

  // Broadcast
  console.log("\n  Cancelling plans...\n");
  let success = 0;
  let failed = 0;

  // Group by address for nonce sequencing
  const byAddress = new Map();
  for (const item of cancellable) {
    if (!byAddress.has(item.address)) byAddress.set(item.address, []);
    byAddress.get(item.address).push(item);
  }

  for (const [address, items] of byAddress) {
    let nonce;
    try {
      nonce = await fetchNonceWithRetry(address);
    } catch (err) {
      console.log(`  ${shortAddr(address)} — nonce error: ${err.message}`);
      failed += items.length;
      continue;
    }

    for (const { index, stxPrivateKey, planId, bal } of items) {
      const label = `  [${String(index).padStart(3)}] ${shortAddr(address)} plan #${planId}`;

      try {
        const tx = await makeContractCall({
          contractAddress: DCA_VAULT.address,
          contractName: DCA_VAULT.name,
          functionName: "cancel-plan",
          functionArgs: [uintCV(planId)],
          senderKey: stxPrivateKey,
          network: STACKS_MAINNET,
          fee: TX_FEE,
          nonce,
          postConditionMode: PostConditionMode.Allow,
        });

        const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
        if (result.error) {
          console.log(`${label}  FAIL  ${result.error}: ${result.reason ?? ""}`);
          failed++;
        } else {
          const txid = typeof result === "string" ? result : result.txid;
          console.log(`${label}  OK    refund: ${formatStx(bal)} STX  tx: ${txid}`);
          success++;
          nonce++;
        }
      } catch (err) {
        console.log(`${label}  FAIL  ${err.message}`);
        failed++;
      }
      await sleep(1500);
    }
    await sleep(1000);
  }

  console.log(`\n  Done! Success: ${success}  Failed: ${failed}  Total: ${cancellable.length}`);
  if (success > 0) {
    console.log(`  Total refunded: ~${formatStx(totalRefund)} STX`);
  }
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check tools/dca-v2.mjs && echo "syntax OK"
```

Expected: `syntax OK`

- [ ] **Step 3: Commit**

```bash
git add tools/dca-v2.mjs
git commit -m "feat(tools): add cancel command to dca-v2"
```

---

### Task 6: Main dispatcher and end-to-end verification

**Files:**
- Modify: `tools/dca-v2.mjs`

- [ ] **Step 1: Append main dispatcher after all command handlers**

```javascript
// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!COMMAND || !["create", "execute", "cancel"].includes(COMMAND)) {
    console.log(`
DCA Vault V2 CLI Tool

Usage:
  node tools/dca-v2.mjs create  --amount <STX> --interval <daily|weekly|monthly> --deposit <STX>
  node tools/dca-v2.mjs execute [--slippage <% default 0.1>]
  node tools/dca-v2.mjs cancel

Shared flags:
  --accounts <n>   Number of accounts to derive (default: ${DEFAULT_NUM_ACCOUNTS})
  --dry-run        Scan only, no transactions broadcast
`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });

  console.log("\n========================================");
  console.log("  DCA Vault V2 — Mainnet");
  console.log("========================================");
  console.log(`  Contract : ${DCA_VAULT.address}.${DCA_VAULT.name}`);
  console.log(`  Command  : ${COMMAND}`);
  console.log(`  Accounts : ${NUM_ACCOUNTS}`);
  console.log(`  Dry run  : ${DRY_RUN ? "YES" : "no"}`);
  console.log("========================================");

  // 1. Get mnemonic
  const mnemonic = await rl.question("\nEnter your mnemonic (12 or 24 words): ");
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    console.error("  Invalid mnemonic — expected 12 or 24 words.");
    rl.close();
    process.exit(1);
  }

  // 2. Derive wallet
  console.log("\n  Deriving wallet...");
  const accounts = await deriveAccounts(mnemonic, NUM_ACCOUNTS);
  console.log(`  Derived ${accounts.length} accounts`);

  // 3. Dispatch command
  if (COMMAND === "create") await cmdCreate(rl, accounts);
  else if (COMMAND === "execute") await cmdExecute(rl, accounts);
  else if (COMMAND === "cancel") await cmdCancel(rl, accounts);

  rl.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify final syntax**

```bash
node --check tools/dca-v2.mjs && echo "syntax OK"
```

Expected: `syntax OK`

- [ ] **Step 3: Test help output (no mnemonic needed)**

```bash
node tools/dca-v2.mjs 2>&1 | head -10
```

Expected output includes:
```
DCA Vault V2 CLI Tool

Usage:
  node tools/dca-v2.mjs create  --amount <STX> --interval <daily|weekly|monthly> --deposit <STX>
```

- [ ] **Step 4: Test invalid command**

```bash
node tools/dca-v2.mjs foo 2>&1 | head -3
```

Expected: shows usage help and exits.

- [ ] **Step 5: Commit**

```bash
git add tools/dca-v2.mjs
git commit -m "feat(tools): add main dispatcher, complete dca-v2 CLI tool"
```
