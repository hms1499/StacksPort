#!/usr/bin/env node

/**
 * STX Sweep Tool
 * Consolidate STX from all derived accounts (1..N) into account 0.
 *
 * Usage:
 *   node tools/sweep-stx.mjs
 *   node tools/sweep-stx.mjs --accounts 30 --dest SP...custom
 *   node tools/sweep-stx.mjs --dry-run
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { generateWallet, generateNewAccount, getStxAddress } from "@stacks/wallet-sdk";
import stxTx from "@stacks/transactions";
const { makeSTXTokenTransfer, broadcastTransaction, getAddressFromPrivateKey } = stxTx;
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";

// ── Config ──────────────────────────────────────────────────────────────────

const NETWORK = "mainnet";
const API_BASE = "https://api.mainnet.hiro.so";
const DEFAULT_NUM_ACCOUNTS = 33;
const TX_FEE = 200n; // 0.0002 STX — standard STX transfer fee
const EXPLORER = "https://explorer.hiro.so/txid";

// ── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flagVal = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};
const hasFlag = (name) => args.includes(name);

const NUM_ACCOUNTS = parseInt(flagVal("--accounts") ?? String(DEFAULT_NUM_ACCOUNTS), 10);
const CUSTOM_DEST = flagVal("--dest");
const DRY_RUN = hasFlag("--dry-run");

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBalance(address, retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${API_BASE}/extended/v1/address/${address}/stx`);
    if (res.status === 429 || res.status === 503) {
      const wait = 5000 + attempt * 3000;
      process.stdout.write(`  ⏳ rate limited, retry ${attempt}/${retries} — waiting ${wait / 1000}s...    \r`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`API error ${res.status} for ${address}`);
    const data = await res.json();
    return BigInt(data.balance) - BigInt(data.locked);
  }
  throw new Error(`API rate limited after ${retries} retries for ${address}`);
}

function stx(micro) {
  return (Number(micro) / 1_000_000).toFixed(6);
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
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

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log("\n========================================");
  console.log("  STX Sweep Tool — Mainnet");
  console.log("========================================");
  console.log(`  Accounts to scan : ${NUM_ACCOUNTS}`);
  console.log(`  Dry run          : ${DRY_RUN ? "YES" : "no"}`);
  console.log(`  Tx fee           : ${stx(TX_FEE)} STX`);
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
  let destAddress;

  if (is12Word) {
    console.log("  Mode: Xverse (BIP44 account-level derivation)");
    derivedAccounts = deriveXverseAccounts(mnemonic, NUM_ACCOUNTS);
    destAddress = CUSTOM_DEST || derivedAccounts[0].address;
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
    destAddress = CUSTOM_DEST || derivedAccounts[0].address;
  }

  console.log(`✓ Derived ${derivedAccounts.length} accounts\n`);

  // 3. Destination address
  console.log(`Destination: ${destAddress}\n`);

  // 4. Scan balances
  console.log("Scanning balances...\n");
  console.log("  #   Address                      Balance (STX)    Sweepable");
  console.log("  ─── ──────────────────────────── ──────────────── ─────────────");

  const sweepable = [];
  let totalSweep = 0n;

  for (const { index, address, stxPrivateKey } of derivedAccounts) {
    const balance = await fetchBalance(address);

    const sendable = balance > TX_FEE ? balance - TX_FEE : 0n;
    const isDest = address === destAddress;
    const marker = isDest ? " ◀ dest" : "";
    const sweepStr = isDest ? "—" : stx(sendable);

    console.log(
      `  ${String(index).padStart(3)}  ${shortAddr(address).padEnd(14)}  ${stx(balance).padStart(16)}  ${sweepStr.padStart(13)}${marker}`
    );

    if (!isDest && sendable > 0n) {
      sweepable.push({ index, address, stxPrivateKey, sendable });
      totalSweep += sendable;
    }

    // Rate limit — avoid 429
    await sleep(1200);
  }

  console.log("\n────────────────────────────────────────────────────────────────");
  console.log(`  Accounts with balance : ${sweepable.length}`);
  console.log(`  Total to sweep        : ${stx(totalSweep)} STX`);
  console.log(`  Total fees            : ${stx(TX_FEE * BigInt(sweepable.length))} STX`);
  console.log("────────────────────────────────────────────────────────────────\n");

  if (sweepable.length === 0) {
    console.log("Nothing to sweep. All balances are zero or below fee threshold.");
    rl.close();
    return;
  }

  if (DRY_RUN) {
    console.log("🏁 Dry run complete — no transactions sent.");
    rl.close();
    return;
  }

  // 5. Confirm
  const confirm = await rl.question(`Sweep ${stx(totalSweep)} STX from ${sweepable.length} accounts to ${shortAddr(destAddress)}? (yes/no): `);
  if (confirm.trim().toLowerCase() !== "yes") {
    console.log("Cancelled.");
    rl.close();
    return;
  }

  // 6. Execute transfers
  console.log("\nSending transactions...\n");

  let success = 0;
  let failed = 0;

  for (const { index, address, stxPrivateKey, sendable } of sweepable) {
    process.stdout.write(`  [${index}] ${shortAddr(address)} → ${stx(sendable)} STX ... `);

    let sent = false;
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        const tx = await makeSTXTokenTransfer({
          recipient: destAddress,
          amount: sendable,
          senderKey: stxPrivateKey,
          fee: TX_FEE,
          memo: "sweep",
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
          process.stdout.write(`  [${index}] ${shortAddr(address)} → ${stx(sendable)} STX ... `);
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

    // Delay between broadcasts to avoid rate limit
    await sleep(3000);
  }

  // 7. Summary
  console.log("\n========================================");
  console.log(`  Done! ${success} sent, ${failed} failed`);
  console.log(`  Total swept: ~${stx(totalSweep)} STX`);
  console.log(`  Explorer: ${EXPLORER}/<txid>?chain=mainnet`);
  console.log("========================================\n");

  rl.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
