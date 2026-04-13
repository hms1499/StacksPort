#!/usr/bin/env node

/**
 * Cancel DCA Plans Tool
 * Scan derived accounts for active/inactive DCA plans and cancel them to free uid slots.
 *
 * Usage:
 *   node tools/cancel-dca-plans.mjs                          # v2 contract (default)
 *   node tools/cancel-dca-plans.mjs --contract v1            # v1 contract
 *   node tools/cancel-dca-plans.mjs --accounts 50
 *   node tools/cancel-dca-plans.mjs --dry-run
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { generateWallet, generateNewAccount, getStxAddress } from "@stacks/wallet-sdk";
import stxTx from "@stacks/transactions";
const {
  makeContractCall,
  broadcastTransaction,
  getAddressFromPrivateKey,
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
const DEFAULT_NUM_ACCOUNTS = 50;
const TX_FEE = 2000n;
const EXPLORER = "https://explorer.hiro.so/txid";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

// ── DCA Vault Contracts ─────────────────────────────────────────────────────

const CONTRACTS = {
  v1: { address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV", name: "dca-vault" },
  v2: { address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV", name: "dca-vault-v2" },
};

// ── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flagVal = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};
const hasFlag = (name) => args.includes(name);

const NUM_ACCOUNTS = parseInt(flagVal("--accounts") ?? String(DEFAULT_NUM_ACCOUNTS), 10);
const DRY_RUN = hasFlag("--dry-run");
const CONTRACT_VERSION = flagVal("--contract") ?? "v2";
const DCA_VAULT = CONTRACTS[CONTRACT_VERSION] ?? CONTRACTS.v2;

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatStx(micro) {
  return (Number(micro) / 1e6).toFixed(6);
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function cvToHex(cv) {
  const result = serializeCV(cv);
  if (typeof result === "string") return result;
  return Buffer.from(result).toString("hex");
}

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

// ── API helpers with robust retry ──────────────────────────────────────────��

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
      await sleep(5000 + attempt * 3000);
      continue;
    }
    if (!res.ok) {
      await sleep(5000 + attempt * 3000);
      continue;
    }
    let data;
    try {
      data = await res.json();
    } catch {
      await sleep(5000 + attempt * 3000);
      continue;
    }
    return data;
  }
  return null;
}

// ── Fetch user plans ─��──────────────────────────────────────────────────────

async function fetchUserPlans(address) {
  const callArgs = [cvToHex(stxTx.standardPrincipalCV(address))];
  const data = await fetchWithRetry(
    `${HIRO_RO_API}/v2/contracts/call-read/${DCA_VAULT.address}/${DCA_VAULT.name}/get-user-plans`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: callArgs }),
    }
  );
  if (!data?.okay) return [];
  const cv = hexToCV(data.result);
  if (Array.isArray(cv.value)) return cv.value.map((v) => Number(v.value));
  return [];
}

// ── Fetch plan details ──────────────────────────────────────────────────────

async function fetchPlan(planId) {
  const callArgs = [cvToHex(uintCV(planId))];
  const data = await fetchWithRetry(
    `${HIRO_RO_API}/v2/contracts/call-read/${DCA_VAULT.address}/${DCA_VAULT.name}/get-plan`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: callArgs }),
    }
  );
  if (!data?.okay) return null;

  const cv = hexToCV(data.result);
  // Navigate: some(tuple) -> tuple has .value with fields
  const d = cv.value?.data ?? cv.value?.value;
  if (!d) return null;

  return {
    active: d.active?.type === "true" || d.active?.type === "bool-true" || d.active === true,
    bal: BigInt(d.bal?.value ?? 0),
    amt: BigInt(d.amt?.value ?? 0),
    tsd: Number(d.tsd?.value ?? 0),
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log("\n========================================");
  console.log("  Cancel DCA Plans Tool -- Mainnet");
  console.log("========================================");
  console.log(`  Contract  : ${DCA_VAULT.address}.${DCA_VAULT.name}`);
  console.log(`  Version   : ${CONTRACT_VERSION}`);
  console.log(`  Accounts  : ${NUM_ACCOUNTS}`);
  console.log(`  Dry run   : ${DRY_RUN ? "YES" : "no"}`);
  console.log(`  Tx fee    : ${formatStx(TX_FEE)} STX (per cancel)`);
  console.log("========================================\n");

  // 1. Get mnemonic
  const mnemonic = await rl.question("Enter your mnemonic (12 or 24 words): ");
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    console.error("Invalid mnemonic -- expected 12 or 24 words.");
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

  console.log(`  Derived ${derivedAccounts.length} accounts\n`);

  // 3. Scan for cancellable plans
  // v1: cancel only frees balance, does NOT free uid slot (bug)
  // v2: cancel frees both balance AND uid slot (fixed)
  console.log("Scanning accounts for DCA plans...\n");
  console.log("  #   Address          Plans  Active  Inactive  Cancellable");
  console.log("  --- ---------------- -----  ------  --------  -----------");

  const cancellable = []; // { index, address, stxPrivateKey, planId }
  let totalPlans = 0;
  let totalActive = 0;
  let totalInactive = 0;
  const BATCH_SIZE = 3;

  for (let b = 0; b < derivedAccounts.length; b += BATCH_SIZE) {
    const batch = derivedAccounts.slice(b, b + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async ({ index, address, stxPrivateKey }) => {
        const planIds = await fetchUserPlans(address);
        if (planIds.length === 0) return { index, address, stxPrivateKey, plans: [] };

        const plans = [];
        for (const planId of planIds) {
          const plan = await fetchPlan(planId);
          if (plan) plans.push({ planId, ...plan });
        }
        return { index, address, stxPrivateKey, plans };
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled") {
        console.log(`  !! scan error: ${result.reason?.message ?? "unknown"}`);
        continue;
      }

      const { index, address, stxPrivateKey, plans } = result.value;
      if (plans.length === 0) continue;

      const active = plans.filter((p) => p.active);
      const inactive = plans.filter((p) => !p.active);
      // Cancellable: active plans with empty balance, OR inactive plans still in uids (v2 will free slot)
      const toCancel = CONTRACT_VERSION === "v2"
        ? plans.filter((p) => !p.active || p.bal === 0n) // v2: cancel inactive to free slots + cancel empty active
        : plans.filter((p) => p.active && p.bal === 0n);  // v1: can only cancel active plans

      totalPlans += plans.length;
      totalActive += active.length;
      totalInactive += inactive.length;

      console.log(
        `  ${String(index).padStart(3)}  ${shortAddr(address).padEnd(16)} ${String(plans.length).padStart(5)}  ${String(active.length).padStart(6)}  ${String(inactive.length).padStart(8)}  ${String(toCancel.length).padStart(11)}`
      );

      for (const p of toCancel) {
        cancellable.push({ index, address, stxPrivateKey, planId: p.planId });
      }
    }

    await sleep(1000);
  }

  console.log("\n--------------------------------------------------------------------");
  console.log(`  Total plans found     : ${totalPlans}`);
  console.log(`  Active plans          : ${totalActive}`);
  console.log(`  Inactive plans        : ${totalInactive}`);
  console.log(`  Plans to cancel       : ${cancellable.length}`);
  console.log(`  Total fees            : ${formatStx(TX_FEE * BigInt(cancellable.length))} STX`);
  if (CONTRACT_VERSION === "v1") {
    console.log(`  NOTE: v1 cancel does NOT free uid slots. Use --contract v2 for slot recovery.`);
  }
  console.log("--------------------------------------------------------------------\n");

  if (cancellable.length === 0) {
    console.log("Nothing to cancel.");
    rl.close();
    return;
  }

  if (DRY_RUN) {
    console.log("Dry run complete -- no transactions sent.");
    rl.close();
    return;
  }

  // 4. Confirm
  const confirm = await rl.question(
    `Cancel ${cancellable.length} plan(s)? (yes/no): `
  );
  if (confirm.trim().toLowerCase() !== "yes") {
    console.log("Cancelled.");
    rl.close();
    return;
  }

  rl.close();

  // 5. Execute cancellations
  console.log("\nCancelling plans...\n");

  let successCount = 0;
  let failCount = 0;

  // Group by address to handle nonce sequencing
  const byAddress = new Map();
  for (const item of cancellable) {
    if (!byAddress.has(item.address)) byAddress.set(item.address, []);
    byAddress.get(item.address).push(item);
  }

  for (const [address, items] of byAddress) {
    let nonce;
    try {
      nonce = await fetchNonce({ address, network: STACKS_MAINNET });
    } catch (err) {
      console.log(`  ${shortAddr(address)} -- failed to fetch nonce: ${err.message}`);
      failCount += items.length;
      continue;
    }

    for (const { index, stxPrivateKey, planId } of items) {
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
          console.log(`${label}  FAIL ${result.error}: ${result.reason ?? ""}`);
          failCount++;
        } else {
          const txid = typeof result === "string" ? result : result.txid;
          console.log(`${label}  OK  tx: ${txid}`);
          successCount++;
          nonce++; // increment nonce for next tx from same address
        }
      } catch (err) {
        console.log(`${label}  FAIL ${err.message}`);
        failCount++;
      }

      await sleep(500);
    }

    await sleep(1000);
  }

  console.log("\n====================================================================");
  console.log(`  Success: ${successCount}    Failed: ${failCount}    Total: ${cancellable.length}`);
  console.log("====================================================================\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
