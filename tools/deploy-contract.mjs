#!/usr/bin/env node

/**
 * Deploy a Clarity contract to Stacks mainnet.
 *
 * Usage:
 *   node tools/deploy-contract.mjs <contract-name> <contract-file>
 *   node tools/deploy-contract.mjs dca-vault-v2 contracts/dca-vault-v2.clar
 */

import fs from "node:fs";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import stxTx from "@stacks/transactions";
const {
  makeContractDeploy,
  broadcastTransaction,
  fetchNonce,
  getAddressFromPrivateKey,
  PostConditionMode,
} = stxTx;
import { STACKS_MAINNET } from "@stacks/network";
import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";

const EXPLORER = "https://explorer.hiro.so/txid";
const DEPLOY_FEE = 50000n; // 0.05 STX

async function main() {
  const [contractName, contractFile] = process.argv.slice(2);
  if (!contractName || !contractFile) {
    console.error("Usage: node tools/deploy-contract.mjs <contract-name> <contract-file>");
    process.exit(1);
  }

  if (!fs.existsSync(contractFile)) {
    console.error(`File not found: ${contractFile}`);
    process.exit(1);
  }

  const codeBody = fs.readFileSync(contractFile, "utf-8");

  console.log("\n========================================");
  console.log("  Deploy Contract — Mainnet");
  console.log("========================================");
  console.log(`  Contract  : ${contractName}`);
  console.log(`  File      : ${contractFile}`);
  console.log(`  Size      : ${codeBody.length} bytes`);
  console.log(`  Fee       : ${Number(DEPLOY_FEE) / 1e6} STX`);
  console.log("========================================\n");

  const rl = readline.createInterface({ input, output });
  const mnemonic = await rl.question("Enter deployer mnemonic: ");
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    console.error("❌ Invalid mnemonic.");
    rl.close();
    process.exit(1);
  }

  // Derive deployer key
  const wallet = await generateWallet({ secretKey: mnemonic.trim(), password: "" });
  const account = wallet.accounts[0];
  const senderKey = account.stxPrivateKey;
  const address = getStxAddress(account, "mainnet");

  console.log(`  Deployer  : ${address}`);
  console.log(`  Contract ID: ${address}.${contractName}\n`);

  const confirm = await rl.question("Deploy? (yes/no): ");
  if (confirm.trim().toLowerCase() !== "yes") {
    console.log("Cancelled.");
    rl.close();
    return;
  }
  rl.close();

  console.log("\nBuilding transaction...");
  const nonce = await fetchNonce({ address, network: STACKS_MAINNET });

  const tx = await makeContractDeploy({
    contractName,
    codeBody,
    senderKey,
    network: STACKS_MAINNET,
    fee: DEPLOY_FEE,
    nonce,
    postConditionMode: PostConditionMode.Deny,
    clarityVersion: 3,
  });

  console.log("Broadcasting...");
  const serialized = tx.serialize();
  const txHex = typeof serialized === "string" ? serialized : Buffer.from(serialized).toString("hex");

  const res = await fetch("https://api.mainnet.hiro.so/v2/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: Buffer.from(txHex, "hex"),
  });

  const body = await res.text();

  if (!res.ok) {
    console.error(`❌ Broadcast failed (${res.status}):`);
    console.error(`  Raw: ${body}`);
    try {
      const err = JSON.parse(body);
      console.error(`  Error: ${err.error}`);
      console.error(`  Reason: ${err.reason}`);
      if (err.reason_data) console.error(`  Data: ${JSON.stringify(err.reason_data, null, 2)}`);
    } catch {}
    process.exit(1);
  }

  // Success response is a JSON string with the txid
  const txid = body.replace(/"/g, "");
  console.log(`\n✅ Deployed!`);
  console.log(`  txid: ${txid}`);
  console.log(`  ${EXPLORER}/${txid}?chain=mainnet`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
