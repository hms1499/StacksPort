import type { StacksClient } from "./stacks-client";
import type { BotConfig } from "./config";
import { log } from "./logger";

export class NonceManager {
  private currentNonce: number = -1;
  private pendingCount: number = 0;

  constructor(
    private client: StacksClient,
    private config: BotConfig
  ) {}

  async getNextNonce(): Promise<number> {
    if (this.currentNonce === -1) {
      // First call or after reset: fetch from chain
      this.currentNonce = await this.client.getPendingNonce(this.config.keeperAddress);
      this.pendingCount = 0;
      log.info("Nonce fetched from chain", { nonce: this.currentNonce });
    }

    const nonce = this.currentNonce + this.pendingCount;
    this.pendingCount++;
    return nonce;
  }

  confirmTx(): void {
    this.currentNonce++;
    this.pendingCount = Math.max(0, this.pendingCount - 1);
  }

  // Call this on nonce errors to re-fetch from chain next time
  reset(): void {
    log.warn("NonceManager reset — will re-fetch from chain");
    this.currentNonce = -1;
    this.pendingCount = 0;
  }
}
