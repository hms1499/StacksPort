import {
  uintCV,
  standardPrincipalCV,
  contractPrincipalCV,
  serializeCV,
  hexToCV,
  ClarityType,
  noneCV,
  type ClarityValue,
} from "@stacks/transactions";
import { openContractCall } from "@stacks/connect";

export const DCA_CONTRACT_ADDRESS =
  "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";
export const DCA_CONTRACT_NAME = "dca-vault-v2";
export const DEFAULT_SWAP_ROUTER =
  "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router";

export const TARGET_TOKENS = [
  {
    label: "sBTC",
    value: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
  },
] as const;

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78"; // Stacks burn address (always valid on mainnet)

function hiroHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_HIRO_API_KEY;
  return { ...extra, ...(key ? { "x-hiro-api-key": key } : {}) };
}

async function batchedMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 3
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(fn)));
  }
  return results;
}

// Nakamoto Stacks produces ~6.5 blocks/minute
// Daily  = 650 blocks (~1.7 hours)
// Weekly = 4,550 blocks (~11.7 hours)
// Monthly= 19,500 blocks (~2.1 days)
export const INTERVALS = {
  Daily: 650,
  Weekly: 4550,
  Monthly: 19500,
} as const;

export function blocksToInterval(blocks: number): string {
  // Current values
  if (blocks === 650) return "Daily";
  if (blocks === 4550) return "Weekly";
  if (blocks === 19500) return "Monthly";
  // Previous values
  if (blocks === 1300) return "Daily (v2)";
  if (blocks === 9100) return "Weekly (v2)";
  if (blocks === 39000) return "Monthly (v2)";
  // Legacy values (existing plans)
  if (blocks === 9360) return "Daily (legacy)";
  if (blocks === 65520) return "Weekly (legacy)";
  if (blocks === 280800) return "Monthly (legacy)";
  if (blocks === 144) return "Daily (v1)";
  if (blocks === 1008) return "Weekly (v1)";
  if (blocks === 4320) return "Monthly (v1)";
  return `${blocks} blocks`;
}

export function microToToken(micro: number, decimals = 6): number {
  return micro / Math.pow(10, decimals);
}

export function tokenToMicro(amount: number, decimals = 6): number {
  return Math.floor(amount * Math.pow(10, decimals));
}

// Keep microToSTX alias for STX display elsewhere
export const microToSTX = (n: number) => microToToken(n, 6);
export const stxToMicro = (n: number) => tokenToMicro(n, 6);

// ─── Clarity helpers ──────────────────────────────────────────────────────────

function cvHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
  // serializeCV returns hex string in newer @stacks/transactions versions
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result as Uint8Array).toString("hex");
}

function principalCV(contractId: string): ClarityValue {
  const parts = contractId.split(".");
  if (parts.length === 2) return contractPrincipalCV(parts[0], parts[1]);
  return standardPrincipalCV(contractId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCV(cv: ClarityValue): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = cv as unknown as any;
  const t = raw.type;

  // @stacks/transactions returns string type names in this version
  if (t === "uint" || t === "int") return Number(raw.value);
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "none") return null;
  if (t === "some") return parseCV(raw.value);
  if (t === "ok") return parseCV(raw.value);
  if (t === "err") throw new Error("Contract returned error");
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
    case ClarityType.BoolTrue: return true;
    case ClarityType.BoolFalse: return false;
    case ClarityType.ResponseOk: return parseCV(raw.value);
    case ClarityType.ResponseErr: throw new Error("Contract returned error");
    case ClarityType.OptionalNone: return null;
    case ClarityType.OptionalSome: return parseCV(raw.value);
    case ClarityType.Tuple: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {};
      const data: Record<string, ClarityValue> = raw.data ?? raw.value ?? {};
      for (const [k, v] of Object.entries(data)) result[k] = parseCV(v);
      return result;
    }
    case ClarityType.PrincipalStandard:
    case ClarityType.PrincipalContract:
      return String(raw.value ?? raw.address ?? "unknown");
    case ClarityType.List: {
      const list: ClarityValue[] = raw.list ?? raw.value ?? [];
      return list.map((item: ClarityValue) => parseCV(item));
    }
    default: return null;
  }
}

async function readOnly(fn: string, args: string[] = []): Promise<ClarityValue> {
  const res = await fetch(
    `${HIRO_API}/v2/contracts/call-read/${DCA_CONTRACT_ADDRESS}/${DCA_CONTRACT_NAME}/${fn}`,
    {
      method: "POST",
      headers: hiroHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
    }
  );
  const json = await res.json();
  if (!json.okay) throw new Error(json.cause ?? "Read-only call failed");
  return hexToCV(json.result);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DCAStats {
  totalPlans: number;
  totalVolume: number;
  totalExecuted: number;
}

export interface DCAPlan {
  id: number;
  owner: string;
  token: string; // target token contract
  amt: number;   // source token units per swap (micro)
  ivl: number;   // interval in blocks
  leb: number;   // last executed block
  bal: number;   // source token balance remaining (micro)
  tsd: number;   // total swaps done
  tss: number;   // total source tokens spent
  active: boolean;
  cat: number;   // created at block
}

// ─── Read functions ───────────────────────────────────────────────────────────

export async function getDCAStats(): Promise<DCAStats> {
  const cv = await readOnly("get-stats");
  const val = parseCV(cv) as {
    "total-plans": number;
    "total-volume": number;
    "total-executed": number;
  };
  return {
    totalPlans: val["total-plans"],
    totalVolume: val["total-volume"],
    totalExecuted: val["total-executed"],
  };
}

export async function getUserPlanIds(address: string): Promise<number[]> {
  const cv = await readOnly("get-user-plans", [cvHex(standardPrincipalCV(address))]);
  return parseCV(cv) as number[];
}

export async function getPlan(planId: number): Promise<DCAPlan | null> {
  const cv = await readOnly("get-plan", [cvHex(uintCV(planId))]);
  const val = parseCV(cv);
  if (!val) return null;
  return {
    id: planId,
    owner: val.owner ?? "",
    token: val.token ?? "",
    amt: Number(val.amt ?? 0),
    ivl: Number(val.ivl ?? 0),
    leb: Number(val.leb ?? 0),
    bal: Number(val.bal ?? 0),
    tsd: Number(val.tsd ?? 0),
    tss: Number(val.tss ?? 0),
    active: Boolean(val.active),
    cat: Number(val.cat ?? 0),
  };
}

export async function getUserPlans(address: string): Promise<DCAPlan[]> {
  const ids = await getUserPlanIds(address);
  if (ids.length === 0) return [];
  const plans = await batchedMap(ids, getPlan, 3);
  return plans.filter(Boolean) as DCAPlan[];
}

/**
 * Scan a user's recent transactions for successful create-plan calls to the
 * DCA contract and extract the plan IDs. The contract removes plan IDs from
 * its `uids` list when a plan is depleted or cancelled (to free slots under
 * the 10-plan cap), so this is the only way to surface those past plans.
 */
export async function getUserCreatedPlanIds(
  userAddress: string,
  limit = 50
): Promise<number[]> {
  const res = await fetch(
    `${HIRO_API}/extended/v1/address/${userAddress}/transactions_with_transfers?limit=${limit}`,
    { headers: hiroHeaders(), signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results?: any[];
  };
  const contractId = `${DCA_CONTRACT_ADDRESS}.${DCA_CONTRACT_NAME}`;
  const ids = new Set<number>();
  for (const item of json.results ?? []) {
    const tx = item.tx ?? item;
    if (tx.tx_type !== "contract_call") continue;
    const cc = tx.contract_call;
    if (cc?.contract_id !== contractId) continue;
    if (cc.function_name !== "create-plan") continue;
    if (tx.tx_status !== "success") continue;
    // tx_result.repr looks like "(ok u123)"
    const m = (tx.tx_result?.repr ?? "").match(/\(ok u(\d+)\)/);
    if (m) ids.add(Number(m[1]));
  }
  return [...ids];
}

/**
 * Return plans the user created in the past that are NOT in the contract's
 * active `uids` list (i.e., depleted or cancelled). Complements
 * `getUserPlans` which only returns active/paused plans.
 */
export async function getUserCompletedPlans(
  address: string,
  knownActiveIds?: number[]
): Promise<DCAPlan[]> {
  const [activeIds, historicalIds] = await Promise.all([
    knownActiveIds ? Promise.resolve(knownActiveIds) : getUserPlanIds(address).catch(() => [] as number[]),
    getUserCreatedPlanIds(address).catch(() => [] as number[]),
  ]);
  const activeSet = new Set(activeIds);
  const completedIds = historicalIds.filter((id) => !activeSet.has(id));
  if (completedIds.length === 0) return [];
  const plans = await batchedMap(completedIds, getPlan, 3);
  return plans.filter(Boolean) as DCAPlan[];
}

export async function getAllUserPlans(address: string): Promise<{ active: DCAPlan[]; completed: DCAPlan[] }> {
  const activeIds = await getUserPlanIds(address);
  const [activePlans, completedPlans] = await Promise.all([
    activeIds.length > 0 ? batchedMap(activeIds, getPlan, 3).then((p) => p.filter(Boolean) as DCAPlan[]) : Promise.resolve([]),
    getUserCompletedPlans(address, activeIds),
  ]);
  return { active: activePlans, completed: completedPlans };
}

export async function getNextExecutionBlock(planId: number): Promise<number | null> {
  try {
    const cv = await readOnly("next-execution-block", [cvHex(uintCV(planId))]);
    return parseCV(cv) as number;
  } catch {
    return null;
  }
}

export async function getSTXBalance(address: string): Promise<number> {
  const res = await fetch(
    `${HIRO_API}/extended/v1/address/${address}/balances`,
    { headers: hiroHeaders() }
  );
  if (!res.ok) return 0;
  const json = await res.json();
  return Number(json.stx?.balance ?? 0);
}

// ─── Execution history ────────────────────────────────────────────────────────

export interface PlanExecutionEvent {
  txId: string;
  blockHeight: number;
  blockTime: number; // unix seconds; 0 if pending
  status: "success" | "pending" | "failed";
  netSwapped?: number;   // micro-STX actually swapped (from tx_result)
  protocolFee?: number;  // micro-STX fee
  /** sBTC (sats) credited to the plan owner in this same tx, extracted
   *  from ft_transfers. undefined for non-success or when the asset
   *  did not appear in the transfer list. */
  sbtcReceived?: number;
}

const SBTC_ASSET_ID = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token";

// tx_result.repr looks like:
//   (ok (tuple (bal-remaining u...) (net-swapped u...) (protocol-fee u...) (swaps-done u...)))
function parseExecuteResult(repr: string | undefined): { netSwapped?: number; protocolFee?: number } {
  if (!repr) return {};
  const net = repr.match(/net-swapped u(\d+)/);
  const fee = repr.match(/protocol-fee u(\d+)/);
  return {
    netSwapped: net ? Number(net[1]) : undefined,
    protocolFee: fee ? Number(fee[1]) : undefined,
  };
}

/**
 * Fetch the total amount of a specific FT asset transferred TO `recipient`
 * within one transaction. Required because `/transactions_with_transfers`
 * filters ft_transfers to the queried address; for DCA exec txs the output
 * token lands on the user, not the vault, so we need a per-tx detail fetch
 * to find the user-bound amount.
 *
 * Returns base-unit total, or undefined if no matching transfer found.
 */
export async function fetchTxOutputTransfer(
  txId: string,
  assetIdPrefix: string,
  recipient: string
): Promise<number | undefined> {
  try {
    const res = await fetch(
      `${HIRO_API}/extended/v1/tx/${txId}?event_limit=50`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await res.json()) as any;
    const events = (json.events ?? []) as Array<{
      event_type?: string;
      asset?: {
        asset_id?: string;
        amount?: string;
        recipient?: string;
      };
    }>;
    let total = 0;
    let found = false;
    for (const ev of events) {
      if (ev.event_type !== "fungible_token_asset") continue;
      const a = ev.asset;
      if (!a?.asset_id?.startsWith(assetIdPrefix)) continue;
      if (a.recipient !== recipient) continue;
      if (!a.amount) continue;
      total += Number(a.amount);
      found = true;
    }
    return found ? total : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch recent `execute-dca` transactions targeting a specific plan.
 * Looks at the last `limit` txs sent to the DCA contract and filters by
 * function_name + first arg. Keeper bot invocations are included since
 * the contract principal is the address we query, not the user.
 */
export async function getPlanExecutionHistory(
  planId: number,
  limit = 50,
  userAddress?: string
): Promise<PlanExecutionEvent[]> {
  const contractId = `${DCA_CONTRACT_ADDRESS}.${DCA_CONTRACT_NAME}`;
  const res = await fetch(
    `${HIRO_API}/extended/v1/address/${contractId}/transactions_with_transfers?limit=${limit}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
  const json = (await res.json()) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results?: any[];
  };

  const events: PlanExecutionEvent[] = [];
  for (const item of json.results ?? []) {
    const tx = item.tx ?? item;
    if (tx.tx_type !== "contract_call") continue;
    const cc = tx.contract_call;
    if (cc?.function_name !== "execute-dca") continue;
    const firstArg = cc.function_args?.[0];
    if (!firstArg || firstArg.repr !== `u${planId}`) continue;

    const status =
      tx.tx_status === "success" ? "success" :
      tx.tx_status === "pending" ? "pending" : "failed";
    const { netSwapped, protocolFee } = parseExecuteResult(tx.tx_result?.repr);

    // Extract sBTC received from ft_transfers (only present for success txs).
    let sbtcReceived: number | undefined;
    if (status === "success") {
      const transfers = (item.ft_transfers ?? []) as Array<{
        asset_identifier?: string;
        amount?: string;
      }>;
      for (const t of transfers) {
        if (t.asset_identifier === SBTC_ASSET_ID && t.amount) {
          sbtcReceived = (sbtcReceived ?? 0) + Number(t.amount);
        }
      }
    }

    events.push({
      txId: tx.tx_id,
      blockHeight: Number(tx.block_height ?? 0),
      blockTime: Number(tx.burn_block_time ?? tx.block_time ?? 0),
      status,
      netSwapped,
      protocolFee,
      sbtcReceived,
    });
  }

  // When the caller provides the plan owner, enrich each successful event
  // with sbtcReceived by fetching the full event list per tx (the
  // /transactions_with_transfers endpoint filters ft_transfers to the
  // queried address, which is the vault — sBTC goes pool→router→user, so
  // the vault's ft_transfers is always empty for execute-dca).
  if (userAddress) {
    await Promise.all(
      events.map(async (e) => {
        if (e.status !== "success") return;
        const amount = await fetchTxOutputTransfer(
          e.txId,
          "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
          userAddress
        );
        if (amount !== undefined) e.sbtcReceived = amount;
      })
    );
  }

  return events;
}

export interface LumpSumScenario {
  /** ISO date (YYYY-MM-DD, UTC) used as the reference for the lump-sum buy. */
  referenceDate: string;
  /** STX-USD closing price on referenceDate. */
  stxUsdAtRef: number;
  /** BTC-USD closing price on referenceDate. */
  btcUsdAtRef: number;
  /** sBTC that the total STX-in would have bought if dumped on referenceDate. */
  lumpSumSbtc: number;
  /** actualSbtc - lumpSumSbtc (positive = DCA outperformed lump sum). */
  deltaSbtc: number;
  /** Percentage delta vs lump sum baseline. */
  deltaPct: number;
}

export function utcIsoDateFromUnix(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Compute the lump-sum counterfactual for a plan: had the user spent
 * `perf.totalStxIn` STX on the day of their first execution (or any
 * supplied reference date), how much sBTC would they have ended up with?
 *
 * `stxUsdAtRef` / `btcUsdAtRef` are USD spot prices on that day. The
 * caller fetches them via `getHistoricalStxBtcPrices`.
 */
export function computeLumpSum(
  perf: { totalStxIn: number; totalSbtcOut: number },
  referenceDate: string,
  stxUsdAtRef: number,
  btcUsdAtRef: number
): LumpSumScenario | null {
  if (stxUsdAtRef <= 0 || btcUsdAtRef <= 0 || perf.totalStxIn <= 0) return null;
  // STX → USD → BTC. sBTC pegs 1:1 with BTC; we use BTC USD as proxy.
  const usdAvailable = perf.totalStxIn * stxUsdAtRef;
  const lumpSumSbtc = usdAvailable / btcUsdAtRef;
  const deltaSbtc = perf.totalSbtcOut - lumpSumSbtc;
  const deltaPct = lumpSumSbtc > 0 ? (deltaSbtc / lumpSumSbtc) * 100 : 0;
  return {
    referenceDate,
    stxUsdAtRef,
    btcUsdAtRef,
    lumpSumSbtc,
    deltaSbtc,
    deltaPct,
  };
}

export interface PlanPerformance {
  planId: number;
  executionCount: number;     // success only
  totalStxIn: number;         // STX (decimal)
  totalSbtcOut: number;       // sBTC (decimal, 8dp)
  /** STX per sBTC averaged across all successful executions (weighted
   *  by STX in). Falls back to 0 when there is no executed volume. */
  avgStxPerSbtc: number;
  totalFeeStx: number;        // STX (decimal)
  firstExecutionAt: number | null; // unix seconds
  lastExecutionAt: number | null;  // unix seconds
  successfulEvents: PlanExecutionEvent[]; // sorted ascending by blockTime
}

/**
 * Aggregate execution events into a per-plan cost-basis summary. Pure
 * function — caller is responsible for fetching the events first. Drops
 * non-success events and events missing the sBTC transfer (those can't
 * contribute to cost basis).
 */
export function aggregatePlanPerformance(
  planId: number,
  events: PlanExecutionEvent[]
): PlanPerformance {
  const successful = events
    .filter((e) => e.status === "success" && (e.sbtcReceived ?? 0) > 0 && (e.netSwapped ?? 0) > 0)
    .sort((a, b) => a.blockTime - b.blockTime);

  let totalStxMicro = 0;
  let totalSbtcSats = 0;
  let totalFeeMicro = 0;
  for (const e of successful) {
    totalStxMicro += e.netSwapped ?? 0;
    totalSbtcSats += e.sbtcReceived ?? 0;
    totalFeeMicro += e.protocolFee ?? 0;
  }

  const totalStxIn = totalStxMicro / 1_000_000;
  const totalSbtcOut = totalSbtcSats / 100_000_000;
  const avgStxPerSbtc = totalSbtcOut > 0 ? totalStxIn / totalSbtcOut : 0;

  return {
    planId,
    executionCount: successful.length,
    totalStxIn,
    totalSbtcOut,
    avgStxPerSbtc,
    totalFeeStx: totalFeeMicro / 1_000_000,
    firstExecutionAt: successful[0]?.blockTime ?? null,
    lastExecutionAt: successful[successful.length - 1]?.blockTime ?? null,
    successfulEvents: successful,
  };
}

// ─── Write functions ──────────────────────────────────────────────────────────

export function createPlan(
  targetToken: string,
  amountPerInterval: number,
  intervalBlocks: number,
  initialDeposit: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const [tAddr, tName] = targetToken.split(".");
  openContractCall({
    contractAddress: DCA_CONTRACT_ADDRESS,
    contractName: DCA_CONTRACT_NAME,
    functionName: "create-plan",
    functionArgs: [
      contractPrincipalCV(tAddr, tName),
      uintCV(amountPerInterval),
      uintCV(intervalBlocks),
      uintCV(initialDeposit),
    ],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function depositToPlan(
  planId: number,
  amount: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_CONTRACT_ADDRESS,
    contractName: DCA_CONTRACT_NAME,
    functionName: "deposit",
    functionArgs: [uintCV(planId), uintCV(amount)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function executePlan(
  planId: number,
  swapRouter: string,
  minAmountOut: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const [rAddr, rName] = swapRouter.split(".");
  openContractCall({
    contractAddress: DCA_CONTRACT_ADDRESS,
    contractName: DCA_CONTRACT_NAME,
    functionName: "execute-dca",
    functionArgs: [
      uintCV(planId),
      contractPrincipalCV(rAddr, rName),
      uintCV(minAmountOut),
    ],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function cancelPlan(
  planId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_CONTRACT_ADDRESS,
    contractName: DCA_CONTRACT_NAME,
    functionName: "cancel-plan",
    functionArgs: [uintCV(planId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function pausePlan(
  planId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_CONTRACT_ADDRESS,
    contractName: DCA_CONTRACT_NAME,
    functionName: "pause-plan",
    functionArgs: [uintCV(planId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function resumePlan(
  planId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_CONTRACT_ADDRESS,
    contractName: DCA_CONTRACT_NAME,
    functionName: "resume-plan",
    functionArgs: [uintCV(planId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

// noneCV export for memo field
export { noneCV, principalCV };
