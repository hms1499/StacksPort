import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  listCV,
  tupleCV,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import type { BotConfig } from "./config.js";
import { log } from "./logger.js";
import { sleep } from "./stacks-client.js";

export interface BatchPlan {
  planId: number;
  vaultType: 0 | 1; // 0 = dca-vault (STX→sBTC), 1 = dca-vault-sbtc-v2 (sBTC→USDCx)
}

const BASE_FEE_USTX     = 5_000;
const PER_PLAN_FEE_USTX = 500;
const RETRY_DELAYS      = [2000, 5000, 10000]; // ms

function calcFee(planCount: number): bigint {
  return BigInt(BASE_FEE_USTX + planCount * PER_PLAN_FEE_USTX);
}

export class BatchExecutor {
  constructor(private config: BotConfig) {}

  async executeBatch(plans: BatchPlan[], nonce?: number): Promise<string> {
    const [contractAddress, contractName] = this.config.batchExecutorContract.split(".");

    const planArgs = plans.map((p) =>
      tupleCV({
        "plan-id":    uintCV(p.planId),
        "vault-type": uintCV(p.vaultType),
      })
    );

    const fee = calcFee(plans.length);

    const tx = await makeContractCall({
      contractAddress,
      contractName,
      functionName:  "batch-execute-dca",
      functionArgs:  [listCV(planArgs)],
      senderKey:     this.config.keeperPrivateKey,
      network:       STACKS_MAINNET,
      fee,
      ...(nonce !== undefined ? { nonce: BigInt(nonce) } : {}),
      postConditionMode: 1, // Allow
    });

    // Override SDK fee estimate — force our calculated fee
    tx.setFee(fee);

    log.info("Broadcasting batch tx", {
      planCount: plans.length,
      feeUstx: Number(fee),
      feeSTX: (Number(fee) / 1_000_000).toFixed(6),
    });

    const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });

    if ("error" in result && result.error) {
      throw new Error(`Broadcast failed: ${result.error} — ${result.reason ?? ""}`);
    }

    return result.txid;
  }

  async executeBatchWithRetry(
    plans: BatchPlan[],
    nonce?: number
  ): Promise<{ txid: string } | null> {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const txid = await this.executeBatch(plans, nonce);
        return { txid };
      } catch (err: unknown) {
        const isLast = attempt === RETRY_DELAYS.length;
        const msg    = err instanceof Error ? err.message : String(err);
        log.error("Batch broadcast error", { attempt, planCount: plans.length, msg });
        if (isLast) return null;
        await sleep(RETRY_DELAYS[attempt]);
      }
    }
    return null;
  }
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
