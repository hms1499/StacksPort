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
