import {
  hexToCV,
  ClarityType,
  type ClarityValue,
  uintCV,
  serializeCV,
  standardPrincipalCV,
} from "@stacks/transactions";
import type { BotConfig } from "./config";
import type { BatchPlan } from "./batch-executor";
import { log } from "./logger";

const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

// ─── CV Helpers ───────────────────────────────────────────────────────────────

function cvHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result as Uint8Array).toString("hex");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCV(cv: ClarityValue): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = cv as unknown as any;
  const t   = raw.type;

  if (t === "uint" || t === "int") return Number(raw.value);
  if (t === "true")  return true;
  if (t === "false") return false;
  if (t === "none")  return null;
  if (t === "some")  return parseCV(raw.value);
  if (t === "ok")    return parseCV(raw.value);
  if (t === "err")   throw new Error("Contract returned error");
  if (t === "address" || t === "contract") return String(raw.value);
  if (t === "tuple") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    const data: Record<string, ClarityValue> = raw.value ?? {};
    for (const [k, v] of Object.entries(data)) result[k] = parseCV(v);
    return result;
  }
  if (t === "list") {
    const list: ClarityValue[] = raw.value ?? [];
    return list.map((item: ClarityValue) => parseCV(item));
  }

  // Fallback: legacy numeric ClarityType enum
  switch (cv.type) {
    case ClarityType.UInt:
    case ClarityType.Int:
      return Number(raw.value);
    case ClarityType.BoolTrue:      return true;
    case ClarityType.BoolFalse:     return false;
    case ClarityType.ResponseOk:    return parseCV(raw.value);
    case ClarityType.ResponseErr:   throw new Error("Contract returned error");
    case ClarityType.OptionalNone:  return null;
    case ClarityType.OptionalSome:  return parseCV(raw.value);
    case ClarityType.Tuple: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {};
      const data: Record<string, ClarityValue> = raw.data ?? raw.value ?? {};
      for (const [k, v] of Object.entries(data)) result[k] = parseCV(v);
      return result;
    }
    case ClarityType.List: {
      const list: ClarityValue[] = raw.list ?? raw.value ?? [];
      return list.map((item: ClarityValue) => parseCV(item));
    }
    default: return null;
  }
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export class StacksClient {
  constructor(private config: BotConfig) {}

  private async readOnly(
    contractAddress: string,
    contractName: string,
    fn: string,
    args: string[] = []
  ): Promise<ClarityValue> {
    const url = `${this.config.hiroApiUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/${fn}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
    });

    if (res.status === 429) throw new Error("RateLimited");

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status >= 500 || text.includes("upstream")) throw new Error("RateLimited");
      throw new Error(`API error ${res.status}: ${text.slice(0, 120)}`);
    }

    const json = await res.json() as { okay: boolean; result: string; cause?: string };
    if (!json.okay) throw new Error(json.cause ?? "Read-only call failed");
    return hexToCV(json.result);
  }

  private parseContract(fullName: string): [string, string] {
    const [addr, name] = fullName.split(".");
    return [addr, name];
  }

  async getTotalPlans(vaultContract: string): Promise<number> {
    const [addr, name] = this.parseContract(vaultContract);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const cv = await this.readOnly(addr, name, "get-stats");
        const val = parseCV(cv) as { "total-plans": number };
        return val["total-plans"];
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt < 2 && (msg === "RateLimited" || msg.includes("upstream"))) {
          await sleep(3000 * (attempt + 1));
          continue;
        }
        throw new Error(`getTotalPlans(${vaultContract}) failed: ${msg}`);
      }
    }
    return 0;
  }

  async canExecute(vaultContract: string, planId: number): Promise<boolean> {
    const [addr, name] = this.parseContract(vaultContract);
    const cv = await this.readOnly(addr, name, "can-execute", [cvHex(uintCV(planId))]);
    return parseCV(cv) as boolean;
  }

  async getKeeperBalance(): Promise<number> {
    const res = await fetch(
      `${this.config.hiroApiUrl}/v2/accounts/${this.config.keeperAddress}?proof=0`
    );
    if (!res.ok) return 0;
    const json = await res.json() as { balance: string };
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
      const json = await res.json() as { nonce: number };
      return json.nonce;
    }
    throw new Error(`Failed to fetch nonce for ${address} after retries`);
  }

  // Scan a single vault for executable plan IDs
  async getExecutablePlanIds(
    vaultContract: string,
    totalPlans: number
  ): Promise<number[]> {
    const executable: number[]   = [];
    let rateLimitRetries         = 0;
    const MAX_RATE_LIMIT_RETRIES = 5;
    const BATCH_SIZE             = 30;
    const BATCH_PAUSE_MS         = 2000;
    const CALL_DELAY_MS          = 200;
    let callsSincePause          = 0;

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
        if (msg === "RateLimited") {
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
        // Skip non-retryable errors silently
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

  // Scan both vaults and return combined BatchPlan list
  async getExecutablePlansForBothVaults(): Promise<BatchPlan[]> {
    const { stxVaultContract, sbtcVaultContract } = this.config;

    const [stxTotal, sbtcTotal] = await Promise.all([
      this.getTotalPlans(stxVaultContract),
      this.getTotalPlans(sbtcVaultContract),
    ]);

    log.info("Total plans per vault", { stxTotal, sbtcTotal });

    // Scan sequentially to avoid doubling API rate
    const stxIds  = stxTotal  > 0 ? await this.getExecutablePlanIds(stxVaultContract,  stxTotal)  : [];
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

export { standardPrincipalCV };
