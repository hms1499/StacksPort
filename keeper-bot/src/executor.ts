import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  contractPrincipalCV,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import type { BotConfig } from "./config";
import { log } from "./logger";
import { sleep } from "./stacks-client";

const TX_FEE = BigInt(3000); // 0.003 STX per execution
const RETRY_DELAYS = [1000, 3000, 8000]; // 1s, 3s, 8s

export class Executor {
  constructor(private config: BotConfig) {}

  async executePlan(planId: number, nonce: number): Promise<string> {
    const [routerAddr, routerName] = this.config.swapRouter.split(".");

    const tx = await makeContractCall({
      contractAddress: this.config.contractAddress,
      contractName:    this.config.contractName,
      functionName:    "execute-dca",
      functionArgs: [
        uintCV(planId),
        contractPrincipalCV(routerAddr, routerName),
        uintCV(this.config.minAmountOut),
      ],
      senderKey:        this.config.keeperPrivateKey,
      network:          STACKS_MAINNET,
      nonce:            BigInt(nonce),
      fee:              TX_FEE,
      postConditionMode: 1, // Allow
    });

    const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });

    if ("error" in result && result.error) {
      throw new Error(`Broadcast failed: ${result.error} — ${result.reason ?? ""}`);
    }

    return result.txid;
  }

  // Returns true if error is nonce-related
  isNonceError(err: unknown): boolean {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return msg.includes("conflictingnonce") || msg.includes("badnonce") || msg.includes("nonce");
  }

  async executePlanWithRetry(
    planId: number,
    getNonce: () => Promise<number>,
    confirmNonce: () => void,
    resetNonce: () => void
  ): Promise<{ txid: string } | null> {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const nonce = await getNonce();
        const txid = await this.executePlan(planId, nonce);
        confirmNonce();
        return { txid };
      } catch (err: unknown) {
        const isLast = attempt === RETRY_DELAYS.length;
        const msg = err instanceof Error ? err.message : String(err);

        if (this.isNonceError(err)) {
          resetNonce();
          log.warn("Nonce error, resetting", { planId, attempt, msg });
          if (isLast) return null;
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }

        log.error("Execute error", { planId, attempt, msg });
        if (isLast) return null;
        await sleep(RETRY_DELAYS[attempt]);
      }
    }

    return null;
  }
}
