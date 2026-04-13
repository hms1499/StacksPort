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
