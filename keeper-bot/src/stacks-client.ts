import { DCAVault } from "@stacksport/dca-sdk";
import type { BotConfig } from "./config.js";
import type { BatchPlan } from "./batch-executor.js";
import { log } from "./logger.js";

export class StacksClient {
  private stxVault: DCAVault;
  private sbtcVault: DCAVault;

  constructor(private config: BotConfig) {
    this.stxVault = new DCAVault("stx-to-sbtc", {
      apiUrl: config.hiroApiUrl,
    });
    this.sbtcVault = new DCAVault("sbtc-to-usdcx", {
      apiUrl: config.hiroApiUrl,
    });
  }

  private getVault(vaultContract: string): DCAVault {
    return vaultContract.includes("sbtc") ? this.sbtcVault : this.stxVault;
  }

  async getTotalPlans(vaultContract: string): Promise<number> {
    const vault = this.getVault(vaultContract);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const stats = await vault.getStats();
        return stats.totalPlans;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt < 2 && (msg.includes("429") || msg.includes("RateLimit") || msg.includes("upstream"))) {
          await sleep(3000 * (attempt + 1));
          continue;
        }
        throw new Error(`getTotalPlans(${vaultContract}) failed: ${msg}`);
      }
    }
    return 0;
  }

  async canExecute(vaultContract: string, planId: number): Promise<boolean> {
    const vault = this.getVault(vaultContract);
    return vault.canExecute(planId);
  }

  async getKeeperBalance(): Promise<number> {
    const res = await fetch(
      `${this.config.hiroApiUrl}/v2/accounts/${this.config.keeperAddress}?proof=0`
    );
    if (!res.ok) return 0;
    const json = (await res.json()) as { balance: string };
    return Number(json.balance ?? 0);
  }

  async getAccountNonce(address: string): Promise<number> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${this.config.hiroApiUrl}/v2/accounts/${address}?proof=0`);
      if (res.status === 429) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`Failed to fetch nonce for ${address}`);
      const json = (await res.json()) as { nonce: number };
      return json.nonce;
    }
    throw new Error(`Failed to fetch nonce for ${address} after retries`);
  }

  async getExecutablePlanIds(
    vaultContract: string,
    totalPlans: number
  ): Promise<number[]> {
    const executable: number[] = [];
    let rateLimitRetries = 0;
    const MAX_RATE_LIMIT_RETRIES = 5;
    const BATCH_SIZE = 30;
    const BATCH_PAUSE_MS = 2000;
    const CALL_DELAY_MS = 200;
    let callsSincePause = 0;

    const scanStart = Date.now();
    let scanned = 0;

    for (let id = totalPlans; id >= 1; id--) {
      try {
        const canExec = await this.canExecute(vaultContract, id);
        if (canExec) executable.push(id);
        rateLimitRetries = 0;
        callsSincePause++;
        scanned++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429") || msg.includes("RateLimit")) {
          rateLimitRetries++;
          if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
            log.warn("Too many rate limits, stopping scan early", { vaultContract, stoppedAtId: id });
            break;
          }
          await sleep(5000 * rateLimitRetries);
          id++;
          callsSincePause = 0;
          continue;
        }
      }

      if (callsSincePause >= BATCH_SIZE) {
        log.info("Scan progress", {
          vaultContract: vaultContract.split(".")[1],
          scanned,
          total: totalPlans,
          found: executable.length,
          elapsed: `${((Date.now() - scanStart) / 1000).toFixed(0)}s`,
        });
        await sleep(BATCH_PAUSE_MS);
        callsSincePause = 0;
      } else {
        await sleep(CALL_DELAY_MS);
      }
    }

    executable.sort((a, b) => a - b);
    return executable;
  }

  async getExecutablePlansForBothVaults(): Promise<BatchPlan[]> {
    const { stxVaultContract, sbtcVaultContract } = this.config;

    const [stxTotal, sbtcTotal] = await Promise.all([
      this.getTotalPlans(stxVaultContract),
      this.getTotalPlans(sbtcVaultContract),
    ]);

    log.info("Total plans per vault", { stxTotal, sbtcTotal });

    const stxIds = stxTotal > 0 ? await this.getExecutablePlanIds(stxVaultContract, stxTotal) : [];
    const sbtcIds = sbtcTotal > 0 ? await this.getExecutablePlanIds(sbtcVaultContract, sbtcTotal) : [];

    log.info("Executable plans found", {
      stxExecutable: stxIds.length,
      sbtcExecutable: sbtcIds.length,
      stxPlanIds: stxIds,
      sbtcPlanIds: sbtcIds,
    });

    const plans: BatchPlan[] = [
      ...stxIds.map((id) => ({ planId: id, vaultType: 0 as const })),
      ...sbtcIds.map((id) => ({ planId: id, vaultType: 1 as const })),
    ];

    return plans;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
