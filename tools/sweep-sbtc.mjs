#!/usr/bin/env node

/**
 * sBTC Sweep Tool
 * Consolidate sBTC from all derived accounts (1..N) into account 0.
 *
 * Usage:
 *   node tools/sweep-sbtc.mjs
 *   node tools/sweep-sbtc.mjs --accounts 33 --dest SP...custom
 *   node tools/sweep-sbtc.mjs --dry-run
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
  standardPrincipalCV,
  noneCV,
  PostConditionMode,
} = stxTx;
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";

// ── Config ──────────────────────────────────────────────────────────────────

const NETWORK = "mainnet";
const API_BASE = "https://api.mainnet.hiro.so";
const DEFAULT_NUM_ACCOUNTS = 33;
const TX_FEE = 2000n; // 0.002 STX — contract call fee (higher than simple transfer)
const EXPLORER = "https://explorer.hiro.so/txid";

// sBTC contract
const SBTC_CONTRACT_ADDRESS = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const SBTC_CONTRACT_NAME = "sbtc-token";
const SBTC_DECIMALS = 8;

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

async function fetchSbtcBalance(address, retries = 10) {
  const contractId = `${SBTC_CONTRACT_ADDRESS}.${SBTC_CONTRACT_NAME}`;
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
    const ft = data.fungible_tokens?.[`${contractId}::sbtc-token`];
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

function formatSbtc(sats) {
  return (Number(sats) / 1e8).toFixed(8);
}

function formatStx(micro) {
  return (Number(micro) / 1e6).toFixed(6);
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
    const privKeyHex = Buffer.from(childKey.privateKey).toString("hex") + "01"; // compressed
    const address = getAddressFromPrivateKey(privKeyHex);
    accounts.push({ index: i, address, stxPrivateKey: privKeyHex });
  }

  return accounts;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log("\n========================================");
  console.log("  sBTC Sweep Tool — Mainnet");
  console.log("========================================");
  console.log(`  Contract       : ${SBTC_CONTRACT_ADDRESS}.${SBTC_CONTRACT_NAME}`);
  console.log(`  Accounts       : ${NUM_ACCOUNTS}`);
  console.log(`  Dry run        : ${DRY_RUN ? "YES" : "no"}`);
  console.log(`  Tx fee         : ${formatStx(TX_FEE)} STX (per transfer)`);
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

  let derivedAccounts; // array of { index, address, stxPrivateKey }
  let destAddress;

  if (is12Word) {
    // Xverse-style derivation: m/44'/5757'/{accountIndex}'/0/0
    console.log("  Mode: Xverse (BIP44 account-level derivation)");
    derivedAccounts = deriveXverseAccounts(mnemonic, NUM_ACCOUNTS);
    destAddress = CUSTOM_DEST || derivedAccounts[0].address;
  } else {
    // Leather-style derivation via @stacks/wallet-sdk
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
  console.log("Scanning sBTC balances...\n");
  console.log("  #   Address          sBTC Balance      STX (for fee)");
  console.log("  ─── ──────────────── ──────────────── ──────────────");

  const sweepable = [];
  let totalSweep = 0n;
  let lowFeeAccounts = 0;

  for (const { index, address, stxPrivateKey } of derivedAccounts) {
    const sbtcBalance = await fetchSbtcBalance(address);
    await sleep(600);
    const stxBalance = await fetchStxBalance(address);

    const isDest = address === destAddress;
    const marker = isDest ? " ◀ dest" : "";
    const hasFee = stxBalance >= TX_FEE;
    const feeWarning = !isDest && sbtcBalance > 0n && !hasFee ? " ⚠ low STX" : "";

    console.log(
      `  ${String(index).padStart(3)}  ${shortAddr(address).padEnd(14)}  ${formatSbtc(sbtcBalance).padStart(16)}  ${formatStx(stxBalance).padStart(14)}${marker}${feeWarning}`
    );

    if (!isDest && sbtcBalance > 0n) {
      if (hasFee) {
        sweepable.push({ index, address, stxPrivateKey, sbtcBalance });
        totalSweep += sbtcBalance;
      } else {
        lowFeeAccounts++;
      }
    }

    // Rate limit
    await sleep(1200);
  }

  console.log("\n────────────────────────────────────────────────────────────────");
  console.log(`  Accounts to sweep     : ${sweepable.length}`);
  console.log(`  Total sBTC to sweep   : ${formatSbtc(totalSweep)} sBTC`);
  console.log(`  Total STX fees        : ${formatStx(TX_FEE * BigInt(sweepable.length))} STX`);
  if (lowFeeAccounts > 0) {
    console.log(`  ⚠ Skipped (low STX)  : ${lowFeeAccounts} accounts — need ${formatStx(TX_FEE)} STX for fee`);
  }
  console.log("────────────────────────────────────────────────────────────────\n");

  if (sweepable.length === 0) {
    console.log("Nothing to sweep.");
    rl.close();
    return;
  }

  if (DRY_RUN) {
    console.log("🏁 Dry run complete — no transactions sent.");
    rl.close();
    return;
  }

  // 5. Confirm
  const confirm = await rl.question(
    `Sweep ${formatSbtc(totalSweep)} sBTC from ${sweepable.length} accounts to ${shortAddr(destAddress)}? (yes/no): `
  );
  if (confirm.trim().toLowerCase() !== "yes") {
    console.log("Cancelled.");
    rl.close();
    return;
  }

  // 6. Execute transfers
  console.log("\nSending transactions...\n");

  let success = 0;
  let failed = 0;

  for (const { index, address, stxPrivateKey, sbtcBalance } of sweepable) {
    process.stdout.write(`  [${index}] ${shortAddr(address)} → ${formatSbtc(sbtcBalance)} sBTC ... `);

    let sent = false;
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        const tx = await makeContractCall({
          contractAddress: SBTC_CONTRACT_ADDRESS,
          contractName: SBTC_CONTRACT_NAME,
          functionName: "transfer",
          functionArgs: [
            uintCV(sbtcBalance),
            standardPrincipalCV(address),
            standardPrincipalCV(destAddress),
            noneCV(),
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
          process.stdout.write(`  [${index}] ${shortAddr(address)} → ${formatSbtc(sbtcBalance)} sBTC ... `);
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

    // Delay between broadcasts
    await sleep(3000);
  }

  // 7. Summary
  console.log("\n========================================");
  console.log(`  Done! ${success} sent, ${failed} failed`);
  console.log(`  Total swept: ~${formatSbtc(totalSweep)} sBTC`);
  console.log(`  Explorer: ${EXPLORER}/<txid>?chain=mainnet`);
  console.log("========================================\n");

  rl.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
