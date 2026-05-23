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
import { fetchTxOutputTransfer } from "./dca";

export const DCA_SBTC_CONTRACT_ADDRESS =
  "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";
export const DCA_SBTC_CONTRACT_NAME = "dca-vault-sbtc-v2";
export const DEFAULT_SBTC_SWAP_ROUTER =
  "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-usdcx-swap-router";

export const SBTC_TARGET_TOKENS = [
  {
    label: "USDCx",
    value: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx",
  },
] as const;

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

// sBTC has 8 decimals (satoshis)
const SBTC_DECIMALS = 8;

// Nakamoto block intervals (same as STX vault)
export const SBTC_INTERVALS = {
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

export function satsToBTC(sats: number): number {
  return sats / Math.pow(10, SBTC_DECIMALS);
}

export function btcToSats(btc: number): number {
  return Math.floor(btc * Math.pow(10, SBTC_DECIMALS));
}

// ─── Clarity helpers ──────────────────────────────────────────────────────────

function cvHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
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
    `${HIRO_API}/v2/contracts/call-read/${DCA_SBTC_CONTRACT_ADDRESS}/${DCA_SBTC_CONTRACT_NAME}/${fn}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
    }
  );
  const json = await res.json();
  if (!json.okay) throw new Error(json.cause ?? "Read-only call failed");
  return hexToCV(json.result);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DCA_SBTCStats {
  totalPlans: number;
  totalVolume: number;   // in satoshis
  totalExecuted: number;
}

export interface DCA_SBTCPlan {
  id: number;
  owner: string;
  token: string;   // target token contract (e.g. USDCx)
  amt: number;     // satoshis per swap
  ivl: number;     // interval in blocks
  leb: number;     // last executed block
  bal: number;     // satoshis balance remaining
  tsd: number;     // total swaps done
  tss: number;     // total sBTC spent (satoshis)
  active: boolean;
  cat: number;     // created at block
}

// ─── Read functions ───────────────────────────────────────────────────────────

export async function getSBTCDCAStats(): Promise<DCA_SBTCStats> {
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

export async function getSBTCUserPlanIds(address: string): Promise<number[]> {
  const cv = await readOnly("get-user-plans", [cvHex(standardPrincipalCV(address))]);
  return parseCV(cv) as number[];
}

export async function getSBTCPlan(planId: number): Promise<DCA_SBTCPlan | null> {
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

export async function getSBTCUserPlans(address: string): Promise<DCA_SBTCPlan[]> {
  const ids = await getSBTCUserPlanIds(address);
  if (ids.length === 0) return [];
  const plans = await Promise.all(ids.map(getSBTCPlan));
  return plans.filter(Boolean) as DCA_SBTCPlan[];
}

/**
 * Like getSBTCUserPlans, but split by `plan.active`. The on-chain uids list
 * never shrinks (cancel-plan does not remove from uids), so completed/cancelled
 * plans are still reachable here.
 */
export async function getAllSBTCUserPlans(
  address: string
): Promise<{ active: DCA_SBTCPlan[]; completed: DCA_SBTCPlan[] }> {
  const plans = await getSBTCUserPlans(address);
  const active: DCA_SBTCPlan[] = [];
  const completed: DCA_SBTCPlan[] = [];
  for (const p of plans) {
    if (p.active) active.push(p);
    else completed.push(p);
  }
  return { active, completed };
}

export async function getSBTCNextExecutionBlock(planId: number): Promise<number | null> {
  try {
    const cv = await readOnly("next-execution-block", [cvHex(uintCV(planId))]);
    return parseCV(cv) as number;
  } catch {
    return null;
  }
}

export async function getSBTCBalance(address: string): Promise<number> {
  const res = await fetch(
    `${HIRO_API}/v2/contracts/call-read/SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4/sbtc-token/get-balance`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: DUMMY_SENDER,
        arguments: [cvHex(standardPrincipalCV(address))],
      }),
    }
  );
  if (!res.ok) return 0;
  const json = await res.json();
  if (!json.okay) return 0;
  try {
    return parseCV(hexToCV(json.result)) as number;
  } catch {
    return 0;
  }
}

// ─── Execution history ────────────────────────────────────────────────────────

export interface SBTCPlanExecutionEvent {
  txId: string;
  blockHeight: number;
  blockTime: number; // unix seconds; 0 if pending
  status: "success" | "pending" | "failed";
  /** sBTC sats actually swapped (from tx_result net-swapped). */
  sbtcIn?: number;
  /** micro-STX fee (gas leg paid in STX). */
  protocolFeeStx?: number;
  /** Target-token base units credited to the plan owner in this tx,
   *  extracted from ft_transfers filtered by the plan's target contract.
   *  Undefined for non-success or when the asset did not appear. */
  tokenOut?: number;
  /** The asset-id prefix used to match ft_transfers (e.g. "SP120...usdcx"). */
  targetTokenContract?: string;
}

function parseSBTCExecuteResult(repr: string | undefined): {
  sbtcIn?: number;
  protocolFeeStx?: number;
} {
  if (!repr) return {};
  const net = repr.match(/net-swapped u(\d+)/);
  const fee = repr.match(/protocol-fee u(\d+)/);
  return {
    sbtcIn: net ? Number(net[1]) : undefined,
    protocolFeeStx: fee ? Number(fee[1]) : undefined,
  };
}

/**
 * Fetch recent `execute-dca` transactions on the sBTC vault for one plan.
 * Mirrors `getPlanExecutionHistory` in dca.ts but scoped to dca-vault-sbtc-v2.
 *
 * `targetTokenContract` is the plan.token value (e.g. "SP120...usdcx"); the
 * scanner filters ft_transfers by `asset_identifier` starting with that.
 */
export async function getSBTCPlanExecutionHistory(
  planId: number,
  targetTokenContract: string,
  limit = 100,
  userAddress?: string
): Promise<SBTCPlanExecutionEvent[]> {
  const contractId = `${DCA_SBTC_CONTRACT_ADDRESS}.${DCA_SBTC_CONTRACT_NAME}`;
  const res = await fetch(
    `${HIRO_API}/extended/v1/address/${contractId}/transactions_with_transfers?limit=${limit}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`Failed to fetch sBTC history: ${res.status}`);
  const json = (await res.json()) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results?: any[];
  };

  const events: SBTCPlanExecutionEvent[] = [];
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
    const { sbtcIn, protocolFeeStx } = parseSBTCExecuteResult(tx.tx_result?.repr);

    let tokenOut: number | undefined;
    if (status === "success") {
      const transfers = (item.ft_transfers ?? []) as Array<{
        asset_identifier?: string;
        amount?: string;
      }>;
      for (const t of transfers) {
        if (
          t.asset_identifier &&
          t.asset_identifier.startsWith(targetTokenContract) &&
          t.amount
        ) {
          tokenOut = (tokenOut ?? 0) + Number(t.amount);
        }
      }
    }

    events.push({
      txId: tx.tx_id,
      blockHeight: Number(tx.block_height ?? 0),
      blockTime: Number(tx.burn_block_time ?? tx.block_time ?? 0),
      status,
      sbtcIn,
      protocolFeeStx,
      tokenOut,
      targetTokenContract,
    });
  }

  if (userAddress) {
    await Promise.all(
      events.map(async (e) => {
        if (e.status !== "success") return;
        const amount = await fetchTxOutputTransfer(
          e.txId,
          targetTokenContract,
          userAddress
        );
        if (amount !== undefined) e.tokenOut = amount;
      })
    );
  }

  return events;
}

export interface SBTCPlanPerformance {
  planId: number;
  executionCount: number;
  /** sats (unscaled). */
  totalSbtcIn: number;
  /** Target-token in base units (e.g. USDCx, scaled by targetTokenDecimals). */
  totalTokenOut: number;
  /** sats per 1 base-unit token. */
  avgSbtcPerToken: number;
  /** Base-unit tokens per 1 sBTC (1 sBTC = 1e8 sats). */
  avgTokenPerSbtc: number;
  firstExecutionAt: number | null;
  lastExecutionAt: number | null;
  successfulEvents: SBTCPlanExecutionEvent[];
  targetTokenContract: string | null;
  targetTokenDecimals: number;
}

/**
 * Aggregate execution events into per-plan performance numbers.
 * Pure — no I/O. `targetTokenDecimals` defaults to 6 (USDCx).
 */
export function aggregateSBTCPlanPerformance(
  planId: number,
  events: SBTCPlanExecutionEvent[],
  targetTokenDecimals = 6
): SBTCPlanPerformance {
  const successful = events.filter((e) => e.status === "success");
  const totalSbtcInSats = successful.reduce((s, e) => s + (e.sbtcIn ?? 0), 0);
  const totalTokenOutMicro = successful.reduce((s, e) => s + (e.tokenOut ?? 0), 0);
  const totalTokenOut = totalTokenOutMicro / Math.pow(10, targetTokenDecimals);
  const totalSbtc = totalSbtcInSats / 1e8;

  const avgSbtcPerToken = totalTokenOut > 0 ? totalSbtcInSats / totalTokenOut : 0;
  const avgTokenPerSbtc = totalSbtc > 0 ? totalTokenOut / totalSbtc : 0;

  const times = successful.map((e) => e.blockTime).filter((t) => t > 0);
  const firstExecutionAt = times.length ? Math.min(...times) : null;
  const lastExecutionAt = times.length ? Math.max(...times) : null;

  const targetTokenContract =
    successful.find((e) => e.targetTokenContract)?.targetTokenContract ??
    events.find((e) => e.targetTokenContract)?.targetTokenContract ??
    null;

  return {
    planId,
    executionCount: events.length,
    totalSbtcIn: totalSbtcInSats,
    totalTokenOut,
    avgSbtcPerToken,
    avgTokenPerSbtc,
    firstExecutionAt,
    lastExecutionAt,
    successfulEvents: successful,
    targetTokenContract,
    targetTokenDecimals,
  };
}

// ─── Write functions ──────────────────────────────────────────────────────────

export function createSBTCPlan(
  targetToken: string,
  amountPerInterval: number,
  intervalBlocks: number,
  initialDeposit: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const [tAddr, tName] = targetToken.split(".");
  openContractCall({
    contractAddress: DCA_SBTC_CONTRACT_ADDRESS,
    contractName: DCA_SBTC_CONTRACT_NAME,
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

export function depositToSBTCPlan(
  planId: number,
  amount: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_SBTC_CONTRACT_ADDRESS,
    contractName: DCA_SBTC_CONTRACT_NAME,
    functionName: "deposit",
    functionArgs: [uintCV(planId), uintCV(amount)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function executeSBTCPlan(
  planId: number,
  swapRouter: string,
  minAmountOut: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const [rAddr, rName] = swapRouter.split(".");
  openContractCall({
    contractAddress: DCA_SBTC_CONTRACT_ADDRESS,
    contractName: DCA_SBTC_CONTRACT_NAME,
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

export function cancelSBTCPlan(
  planId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_SBTC_CONTRACT_ADDRESS,
    contractName: DCA_SBTC_CONTRACT_NAME,
    functionName: "cancel-plan",
    functionArgs: [uintCV(planId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function pauseSBTCPlan(
  planId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_SBTC_CONTRACT_ADDRESS,
    contractName: DCA_SBTC_CONTRACT_NAME,
    functionName: "pause-plan",
    functionArgs: [uintCV(planId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function resumeSBTCPlan(
  planId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_SBTC_CONTRACT_ADDRESS,
    contractName: DCA_SBTC_CONTRACT_NAME,
    functionName: "resume-plan",
    functionArgs: [uintCV(planId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export { noneCV, principalCV };
