// keeper-bot/src/limit-run.ts
// The run-step that fills eligible limit orders: discover → price → quote →
// broadcast one execute-order tx per order → record + push. Pulls in the
// broadcast/price/push machinery; the pure trigger math lives in limit-push.ts.

import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  contractPrincipalCV,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import type { BotConfig } from "./config.js";
import type { StacksClient } from "./stacks-client.js";
import type { SubEntry } from "./redis-store.js";
import { fetchPrices } from "./price-push.js";
import { recordBroadcast } from "./failure-tracker.js";
import { sendLimitFillNotification } from "./dca-push.js";
import { shouldFill, computeMinOut, satsPerUstx } from "./limit-push.js";
import { log } from "./logger.js";

// Protocol fee on the deposit before swapping (must match the contract: PFBPS=30).
const PROTOCOL_FEE_BPS = 30;
// Generous flat fee — execute-order does 2 stx-transfers + a swap contract-call.
const EXECUTE_FEE_USTX = 50_000;
// CoinGecko ids: STX market price + BTC (sBTC is pegged 1:1 to BTC).
const STX_GECKO_ID = "blockstack";
const BTC_GECKO_ID = "bitcoin";

async function broadcastExecuteOrder(
  config: BotConfig,
  orderId: number,
  minOut: number,
  nonce?: number
): Promise<string | null> {
  try {
    const [vaultAddress, vaultName] = config.limitOrderVaultContract.split(".");
    // Execution router lives under the same deployer (network-agnostic).
    const [routerAddress, routerName] = `${vaultAddress}.bitflow-sbtc-swap-router`.split(".");
    const fee = BigInt(EXECUTE_FEE_USTX);

    const tx = await makeContractCall({
      contractAddress: vaultAddress,
      contractName: vaultName,
      functionName: "execute-order",
      functionArgs: [
        uintCV(orderId),
        contractPrincipalCV(routerAddress, routerName),
        uintCV(minOut),
      ],
      senderKey: config.keeperPrivateKey,
      network: STACKS_MAINNET,
      fee,
      ...(nonce !== undefined ? { nonce: BigInt(nonce) } : {}),
      postConditionMode: 1, // Allow
    });
    tx.setFee(fee);

    const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
    if ("error" in result && result.error) {
      throw new Error(`Broadcast failed: ${result.error} — ${result.reason ?? ""}`);
    }
    return result.txid;
  } catch (err) {
    log.error("limit execute-order broadcast failed", { orderId, msg: String(err) });
    return null;
  }
}

// Fill every open order whose target has been hit. One tx per order; records
// each broadcast for the next run's reconcile pass and pushes the owner.
export async function runLimitOrders(deps: {
  client: StacksClient;
  config: BotConfig;
  allSubs: Record<string, SubEntry>;
}): Promise<{ filled: number }> {
  const { client, config, allSubs } = deps;

  const orders = await client.getExecutableLimitOrders();
  if (orders.length === 0) return { filled: 0 };

  const prices = await fetchPrices([STX_GECKO_ID, BTC_GECKO_ID]);
  const stxUsd = prices[STX_GECKO_ID];
  const sbtcUsd = prices[BTC_GECKO_ID];
  // Null-guard: bail safely if the price feed is degraded (matches price-push).
  if (!(stxUsd > 0) || !(sbtcUsd > 0)) {
    log.warn("limit-run: missing price feed, skipping fills", { stxUsd, sbtcUsd });
    return { filled: 0 };
  }

  const quote = satsPerUstx(stxUsd, sbtcUsd);
  const eligible = orders.filter((o) => shouldFill(o, sbtcUsd));
  if (eligible.length === 0) {
    log.info("limit-run: no orders at target", { open: orders.length, sbtcUsd });
    return { filled: 0 };
  }

  log.info("limit-run: filling orders", { count: eligible.length, sbtcUsd });

  // Sequential nonce so multiple fills in one run don't collide before mining.
  let nonce = await client.getAccountNonce(config.keeperAddress);
  let filled = 0;

  for (const o of eligible) {
    const fee = Math.floor((o.amt * PROTOCOL_FEE_BPS) / 10_000);
    const net = o.amt - fee;
    const minOut = computeMinOut(net, quote, config.limitSlippageBps);

    const txid = await broadcastExecuteOrder(config, o.orderId, minOut, nonce);
    if (!txid) continue;
    nonce++;
    filled++;

    log.info("limit-run: order filled", { orderId: o.orderId, txid, minOut });

    recordBroadcast(txid, [o.orderId]).catch((err) =>
      log.warn("limit-run: recordBroadcast failed (non-fatal)", { err: String(err) })
    );
    sendLimitFillNotification(o.owner, o.orderId, txid, allSubs).catch((err) =>
      log.warn("limit-run: push failed (non-fatal)", { err: String(err) })
    );
  }

  return { filled };
}
