import {
  hexToCV,
  ClarityType,
  type ClarityValue,
  uintCV,
  serializeCV,
  standardPrincipalCV,
} from "@stacks/transactions";
import type { BotConfig } from "./config";

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
  const t = raw.type;

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

  private async readOnly(fn: string, args: string[] = []): Promise<ClarityValue> {
    const { hiroApiUrl, contractAddress, contractName } = this.config;
    const url = `${hiroApiUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/${fn}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
    });

    if (res.status === 429) throw new Error("RateLimited");

    const json = await res.json() as { okay: boolean; result: string; cause?: string };
    if (!json.okay) throw new Error(json.cause ?? "Read-only call failed");
    return hexToCV(json.result);
  }

  async getTotalPlans(): Promise<number> {
    const cv = await this.readOnly("get-stats");
    const val = parseCV(cv) as { "total-plans": number };
    return val["total-plans"];
  }

  async canExecute(planId: number): Promise<boolean> {
    const cv = await this.readOnly("can-execute", [cvHex(uintCV(planId))]);
    return parseCV(cv) as boolean;
  }

  async getKeeperBalance(): Promise<number> {
    const { hiroApiUrl, keeperAddress } = this.config;
    const res = await fetch(`${hiroApiUrl}/v2/accounts/${keeperAddress}?proof=0`);
    if (!res.ok) return 0;
    const json = await res.json() as { balance: string };
    return Number(json.balance ?? 0);
  }

  async getAccountNonce(address: string): Promise<number> {
    const { hiroApiUrl } = this.config;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${hiroApiUrl}/v2/accounts/${address}?proof=0`);
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

  async getPendingNonce(address: string): Promise<number> {
    const { hiroApiUrl } = this.config;
    // Use mempool endpoint to get nonce including pending txs
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(
        `${hiroApiUrl}/extended/v1/address/${address}/mempool?limit=50`
      );
      if (res.status === 429) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        // Fallback to account nonce
        return this.getAccountNonce(address);
      }
      const json = await res.json() as { results?: { nonce: number }[] };
      const results = json.results ?? [];
      if (results.length === 0) return this.getAccountNonce(address);

      const maxPendingNonce = Math.max(...results.map((tx) => tx.nonce));
      const accountNonce = await this.getAccountNonce(address);
      return Math.max(maxPendingNonce + 1, accountNonce);
    }
    // All retries exhausted, fallback
    return this.getAccountNonce(address);
  }

  // Get all plan IDs that can be executed right now
  // Scans from newest to oldest (newer plans more likely to be active)
  async getExecutablePlanIds(totalPlans: number): Promise<number[]> {
    const executable: number[] = [];
    let rateLimitRetries = 0;
    const MAX_RATE_LIMIT_RETRIES = 5;
    const BATCH_SIZE = 20;
    const BATCH_PAUSE_MS = 3000;
    const CALL_DELAY_MS = 350;
    let callsSincePause = 0;

    for (let id = totalPlans; id >= 1; id--) {
      try {
        const canExec = await this.canExecute(id);
        if (canExec) executable.push(id);
        rateLimitRetries = 0; // reset on success
        callsSincePause++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "RateLimited") {
          rateLimitRetries++;
          if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
            console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "warn", message: "Rate limit exceeded max retries, stopping scan", scannedSoFar: totalPlans - id, found: executable.length }));
            break;
          }
          // Back off and retry the same plan
          console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "warn", message: "Rate limited, backing off", planId: id, retry: rateLimitRetries }));
          await sleep(5000 * rateLimitRetries);
          id++; // retry this plan ID
          callsSincePause = 0;
          continue;
        }
        // Log other errors instead of silently skipping
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "warn", message: "canExecute failed", planId: id, error: msg }));
      }

      // Batch pause to stay under rate limits
      if (callsSincePause >= BATCH_SIZE) {
        await sleep(BATCH_PAUSE_MS);
        callsSincePause = 0;
      } else {
        await sleep(CALL_DELAY_MS);
      }
    }

    // Sort ascending for execution order
    executable.sort((a, b) => a - b);
    return executable;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { standardPrincipalCV };
