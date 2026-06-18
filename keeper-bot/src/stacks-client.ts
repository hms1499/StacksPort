import { DCAVault } from "@stacksport/dca-sdk";
import {
  serializeCV,
  hexToCV,
  cvToValue,
  uintCV,
  type ClarityValue,
} from "@stacks/transactions";
import type { BotConfig } from "./config.js";
import type { BatchPlan } from "./batch-executor.js";
import { CircuitBreaker, CircuitOpenError } from "./circuit-breaker.js";
import { log } from "./logger.js";

export interface ExecutableLimitOrder {
  orderId: number;
  owner: string;
  amt: number;
  targetUsdMicro: number;
}

export { CircuitOpenError };

export class StacksClient {
  private stxVault: DCAVault;
  private sbtcVault: DCAVault;
  private stxUsdcxVault: DCAVault;
  private vaultsById: Map<string, DCAVault>;
  private hiroBreaker = new CircuitBreaker("hiro-rpc");

  constructor(private config: BotConfig) {
    this.stxVault = new DCAVault("stx-to-sbtc", { apiUrl: config.hiroApiUrl });
    this.sbtcVault = new DCAVault("sbtc-to-usdcx", { apiUrl: config.hiroApiUrl });
    const [, stxUsdcxName] = config.stxUsdcxVaultContract.split(".");
    this.stxUsdcxVault = new DCAVault("stx-to-sbtc", {
      apiUrl: config.hiroApiUrl,
      contractName: stxUsdcxName,
    });
    this.vaultsById = new Map([
      [config.stxVaultContract, this.stxVault],
      [config.sbtcVaultContract, this.sbtcVault],
      [config.stxUsdcxVaultContract, this.stxUsdcxVault],
    ]);
  }

  breakerSnapshot() {
    return this.hiroBreaker.snapshot();
  }

  private getVault(vaultContract: string): DCAVault {
    const v = this.vaultsById.get(vaultContract);
    if (!v) throw new Error(`Unknown vault contract: ${vaultContract}`);
    return v;
  }

  async getTotalPlans(vaultContract: string): Promise<number> {
    const vault = this.getVault(vaultContract);
    return this.hiroBreaker.exec(async () => {
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
    });
  }

  async canExecute(vaultContract: string, planId: number): Promise<boolean> {
    const vault = this.getVault(vaultContract);
    return this.hiroBreaker.exec(() => vault.canExecute(planId));
  }

  async getKeeperBalance(): Promise<number> {
    return this.hiroBreaker.exec(async () => {
      const res = await fetch(
        `${this.config.hiroApiUrl}/v2/accounts/${this.config.keeperAddress}?proof=0`
      );
      if (!res.ok) throw new Error(`getKeeperBalance failed: ${res.status}`);
      const json = (await res.json()) as { balance: string };
      return Number(json.balance ?? 0);
    });
  }

  async getAccountNonce(address: string): Promise<number> {
    return this.hiroBreaker.exec(async () => {
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
    });
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
        if (err instanceof CircuitOpenError) {
          log.warn("Hiro breaker open, aborting scan", { vaultContract, stoppedAtId: id });
          break;
        }
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

  async getExecutablePlansForAllVaults(): Promise<BatchPlan[]> {
    const { stxVaultContract, sbtcVaultContract, stxUsdcxVaultContract } = this.config;

    const [stxTotal, sbtcTotal, stxUsdcxTotal] = await Promise.all([
      this.getTotalPlans(stxVaultContract),
      this.getTotalPlans(sbtcVaultContract),
      this.getTotalPlans(stxUsdcxVaultContract),
    ]);

    log.info("Total plans per vault", { stxTotal, sbtcTotal, stxUsdcxTotal });

    const stxIds = stxTotal > 0 ? await this.getExecutablePlanIds(stxVaultContract, stxTotal) : [];
    const sbtcIds = sbtcTotal > 0 ? await this.getExecutablePlanIds(sbtcVaultContract, sbtcTotal) : [];
    const stxUsdcxIds = stxUsdcxTotal > 0
      ? await this.getExecutablePlanIds(stxUsdcxVaultContract, stxUsdcxTotal)
      : [];

    log.info("Executable plans found", {
      stxExecutable: stxIds.length,
      sbtcExecutable: sbtcIds.length,
      stxUsdcxExecutable: stxUsdcxIds.length,
    });

    const plans: BatchPlan[] = [
      ...stxIds.map((id) => ({ planId: id, vaultType: 0 as const })),
      ...sbtcIds.map((id) => ({ planId: id, vaultType: 1 as const })),
      ...stxUsdcxIds.map((id) => ({ planId: id, vaultType: 2 as const })),
    ];

    return plans;
  }

  // ─── Limit orders ──────────────────────────────────────────────────────────

  private cvHex(cv: ClarityValue): string {
    const result = serializeCV(cv);
    return typeof result === "string"
      ? "0x" + result
      : "0x" + Buffer.from(result as Uint8Array).toString("hex");
  }

  private async callReadOnly(
    contract: string,
    fn: string,
    args: string[] = []
  ): Promise<ClarityValue> {
    const [address, name] = contract.split(".");
    const res = await fetch(
      `${this.config.hiroApiUrl}/v2/contracts/call-read/${address}/${name}/${fn}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: address, arguments: args }),
      }
    );
    const json = (await res.json()) as { okay: boolean; result?: string; cause?: string };
    if (!json.okay || !json.result) throw new Error(json.cause ?? "read-only call failed");
    return hexToCV(json.result);
  }

  // get-stats() -> { oc, tvol, toe }; we only need the order counter.
  private async readOrderCounter(contract: string): Promise<number> {
    const cv = await this.callReadOnly(contract, "get-stats");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = cvToValue(cv) as any;
    return Number(v.oc?.value ?? v.oc ?? 0);
  }

  // get-order(id) -> (optional tuple). Returns null for none.
  private async readOrder(
    contract: string,
    id: number
  ): Promise<{ owner: string; amt: number; targetUsdMicro: number; status: number } | null> {
    const cv = await this.callReadOnly(contract, "get-order", [this.cvHex(uintCV(id))]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const some = cvToValue(cv) as any; // some(tuple) -> { value: {...} } | null
    const t = some?.value ?? some;
    if (!t || t.owner === undefined) return null;
    return {
      owner: String(t.owner.value ?? t.owner),
      amt: Number(t.amt.value ?? t.amt),
      targetUsdMicro: Number(t["target-usd"].value ?? t["target-usd"]),
      status: Number(t.status.value ?? t.status),
    };
  }

  // Walk 1..oc, keep OPEN orders (status 0).
  async getExecutableLimitOrders(): Promise<ExecutableLimitOrder[]> {
    const contract = this.config.limitOrderVaultContract;
    const oc = await this.hiroBreaker.exec(() => this.readOrderCounter(contract));
    const out: ExecutableLimitOrder[] = [];
    for (let id = 1; id <= oc; id++) {
      const order = await this.hiroBreaker.exec(() => this.readOrder(contract, id));
      if (order && order.status === 0) {
        out.push({
          orderId: id,
          owner: order.owner,
          amt: order.amt,
          targetUsdMicro: order.targetUsdMicro,
        });
      }
    }
    return out;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
