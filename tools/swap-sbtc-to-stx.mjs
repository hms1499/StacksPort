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
  if (typeof result === "string") return result;
  return Buffer.from(result).toString("hex");
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

// ── Quote Fetching ───────────────────────────────────────────────────────────

async function fetchSwapQuote(sbtcAmountSats, retries = 6) {
  const callArgs = [
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
        body: JSON.stringify({ sender: DUMMY_SENDER, arguments: callArgs }),
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
