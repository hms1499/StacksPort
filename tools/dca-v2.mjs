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
