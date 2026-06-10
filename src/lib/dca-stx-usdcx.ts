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
import {
  fetchTxOutputTransfer,
  batchedMap,
  getSTXBalance,
  INTERVALS,
  blocksToInterval,
  microToSTX,
  stxToMicro,
} from "./dca";
import {
  DCA_STX_USDCX_CONTRACT_ADDRESS,
  DCA_STX_USDCX_CONTRACT_NAME,
} from "./dca-contracts";

export {
  DCA_STX_USDCX_CONTRACT_ADDRESS,
  DCA_STX_USDCX_CONTRACT_NAME,
} from "./dca-contracts";
export { INTERVALS, blocksToInterval, microToSTX, stxToMicro, getSTXBalance };

export const DEFAULT_STX_USDCX_SWAP_ROUTER =
  "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-usdcx-from-stx-router";

export const STX_USDCX_TARGET_TOKENS = [
  {
    label: "USDCx",
    value: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx",
  },
] as const;

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

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
    `${HIRO_API}/v2/contracts/call-read/${DCA_STX_USDCX_CONTRACT_ADDRESS}/${DCA_STX_USDCX_CONTRACT_NAME}/${fn}`,
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

export interface DcaStxUsdcxStats {
  totalPlans: number;
  totalVolume: number;   // in uSTX
  totalExecuted: number;
}

export interface StxUsdcxPlan {
  id: number;
  owner: string;
  token: string;   // target token contract (e.g. USDCx)
  amt: number;     // uSTX per swap
  ivl: number;     // interval in blocks
  leb: number;     // last executed block
  bal: number;     // uSTX balance remaining
  tsd: number;     // total swaps done
  tss: number;     // total STX spent (uSTX)
  active: boolean;
  cat: number;     // created at block
}

// ─── Read functions ───────────────────────────────────────────────────────────

export async function getStxUsdcxDCAStats(): Promise<DcaStxUsdcxStats> {
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

export async function getStxUsdcxUserPlanIds(address: string): Promise<number[]> {
  const cv = await readOnly("get-user-plans", [cvHex(standardPrincipalCV(address))]);
  return parseCV(cv) as number[];
}

export async function getStxUsdcxPlan(planId: number): Promise<StxUsdcxPlan | null> {
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

export async function getStxUsdcxUserPlans(address: string): Promise<StxUsdcxPlan[]> {
  const ids = await getStxUsdcxUserPlanIds(address);
  if (ids.length === 0) return [];
  const plans = await Promise.all(ids.map(getStxUsdcxPlan));
  return plans.filter(Boolean) as StxUsdcxPlan[];
}

/**
 * Like getStxUsdcxUserPlans, but split by `plan.active`. The on-chain uids list
 * never shrinks (cancel-plan does not remove from uids), so completed/cancelled
 * plans are still reachable here.
 */
export async function getAllStxUsdcxUserPlans(
  address: string
): Promise<{ active: StxUsdcxPlan[]; completed: StxUsdcxPlan[] }> {
  const plans = await getStxUsdcxUserPlans(address);
  const active: StxUsdcxPlan[] = [];
  const completed: StxUsdcxPlan[] = [];
  for (const p of plans) {
    if (p.active) active.push(p);
    else completed.push(p);
  }
  return { active, completed };
}

export async function getStxUsdcxNextExecutionBlock(planId: number): Promise<number | null> {
  try {
    const cv = await readOnly("next-execution-block", [cvHex(uintCV(planId))]);
    return parseCV(cv) as number;
  } catch {
    return null;
  }
}

/** Thin wrapper — STX vault uses native STX balance. */
export async function getStxUsdcxBalance(address: string): Promise<number> {
  return getSTXBalance(address);
}

// ─── Execution history ────────────────────────────────────────────────────────

export interface StxUsdcxExecutionEvent {
  txId: string;
  blockHeight: number;
  blockTime: number; // unix seconds; 0 if pending
  status: "success" | "pending" | "failed";
  /** uSTX actually swapped (from tx_result net-swapped). */
  stxIn?: number;
  /** uSTX protocol fee. */
  protocolFeeStx?: number;
  /** Target-token base units credited to the plan owner in this tx,
   *  extracted from ft_transfers filtered by the plan's target contract.
   *  Undefined for non-success or when the asset did not appear. */
  tokenOut?: number;
  /** The asset-id prefix used to match ft_transfers (e.g. "SP120...usdcx"). */
  targetTokenContract?: string;
}

function parseStxUsdcxExecuteResult(repr: string | undefined): {
  stxIn?: number;
  protocolFeeStx?: number;
} {
  if (!repr) return {};
  const net = repr.match(/net-swapped u(\d+)/);
  const fee = repr.match(/protocol-fee u(\d+)/);
  return {
    stxIn: net ? Number(net[1]) : undefined,
    protocolFeeStx: fee ? Number(fee[1]) : undefined,
  };
}

/**
 * Fetch recent `execute-dca` transactions on the STX→USDCx vault for one plan.
 * Mirrors `getSBTCPlanExecutionHistory` in dca-sbtc.ts but scoped to dca-vault-stx-usdcx.
 *
 * `targetTokenContract` is the plan.token value (e.g. "SP120...usdcx"); the
 * scanner filters ft_transfers by `asset_identifier` starting with that.
 */
export async function getStxUsdcxPlanExecutionHistory(
  planId: number,
  targetTokenContract: string,
  limit = 100,
  userAddress?: string
): Promise<StxUsdcxExecutionEvent[]> {
  const contractId = `${DCA_STX_USDCX_CONTRACT_ADDRESS}.${DCA_STX_USDCX_CONTRACT_NAME}`;
  const res = await fetch(
    `${HIRO_API}/extended/v1/address/${contractId}/transactions_with_transfers?limit=${limit}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`Failed to fetch STX→USDCx history: ${res.status}`);
  const json = (await res.json()) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results?: any[];
  };

  const events: StxUsdcxExecutionEvent[] = [];
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
    const { stxIn, protocolFeeStx } = parseStxUsdcxExecuteResult(tx.tx_result?.repr);

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
      stxIn,
      protocolFeeStx,
      tokenOut,
      targetTokenContract,
    });
  }

  if (userAddress) {
    await batchedMap(events, async (e) => {
      if (e.status !== "success") return;
      const amount = await fetchTxOutputTransfer(
        e.txId,
        targetTokenContract,
        userAddress
      );
      if (amount !== undefined) e.tokenOut = amount;
    }, 5);
  }

  return events;
}

export interface StxUsdcxPerformance {
  planId: number;
  executionCount: number;
  /** uSTX total (unscaled). */
  totalStxIn: number;
  /** Target-token in human units (scaled by targetTokenDecimals). */
  totalTokenOut: number;
  /** uSTX per 1 base-unit token. */
  avgStxPerToken: number;
  /** Base-unit tokens per 1 STX (1 STX = 1e6 uSTX). */
  avgTokenPerStx: number;
  firstExecutionAt: number | null;
  lastExecutionAt: number | null;
  successfulEvents: StxUsdcxExecutionEvent[];
  targetTokenContract: string | null;
  targetTokenDecimals: number;
}

/**
 * Aggregate execution events into per-plan performance numbers.
 * Pure — no I/O. `targetTokenDecimals` defaults to 6 (USDCx).
 *
 * STX is 6 decimals (uSTX), so avgTokenPerStx divides totalStxIn by 1e6.
 */
export function aggregateStxUsdcxPlanPerformance(
  planId: number,
  events: StxUsdcxExecutionEvent[],
  targetTokenDecimals = 6
): StxUsdcxPerformance {
  const successful = events.filter((e) => e.status === "success");
  const totalStxIn = successful.reduce((s, e) => s + (e.stxIn ?? 0), 0);
  const totalTokenOutMicro = successful.reduce((s, e) => s + (e.tokenOut ?? 0), 0);
  const totalTokenOut = totalTokenOutMicro / Math.pow(10, targetTokenDecimals);
  const totalStx = totalStxIn / 1e6;

  const avgStxPerToken = totalTokenOut > 0 ? totalStxIn / totalTokenOut : 0;
  const avgTokenPerStx = totalStx > 0 ? totalTokenOut / totalStx : 0;

  const times = successful.map((e) => e.blockTime).filter((t) => t > 0);
  const firstExecutionAt = times.length ? Math.min(...times) : null;
  const lastExecutionAt = times.length ? Math.max(...times) : null;

  const targetTokenContract =
    successful.find((e) => e.targetTokenContract)?.targetTokenContract ??
    events.find((e) => e.targetTokenContract)?.targetTokenContract ??
    null;

  return {
    planId,
    executionCount: successful.length,
    totalStxIn,
    totalTokenOut,
    avgStxPerToken,
    avgTokenPerStx,
    firstExecutionAt,
    lastExecutionAt,
    successfulEvents: successful,
    targetTokenContract,
    targetTokenDecimals,
  };
}

// ─── Write functions ──────────────────────────────────────────────────────────

export function createStxUsdcxPlan(
  targetToken: string,
  amountPerInterval: number,
  intervalBlocks: number,
  initialDeposit: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const [tAddr, tName] = targetToken.split(".");
  openContractCall({
    contractAddress: DCA_STX_USDCX_CONTRACT_ADDRESS,
    contractName: DCA_STX_USDCX_CONTRACT_NAME,
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

export function depositToStxUsdcxPlan(
  planId: number,
  amount: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_STX_USDCX_CONTRACT_ADDRESS,
    contractName: DCA_STX_USDCX_CONTRACT_NAME,
    functionName: "deposit",
    functionArgs: [uintCV(planId), uintCV(amount)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function executeStxUsdcxPlan(
  planId: number,
  swapRouter: string,
  minAmountOut: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const [rAddr, rName] = swapRouter.split(".");
  openContractCall({
    contractAddress: DCA_STX_USDCX_CONTRACT_ADDRESS,
    contractName: DCA_STX_USDCX_CONTRACT_NAME,
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

export function cancelStxUsdcxPlan(
  planId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_STX_USDCX_CONTRACT_ADDRESS,
    contractName: DCA_STX_USDCX_CONTRACT_NAME,
    functionName: "cancel-plan",
    functionArgs: [uintCV(planId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function pauseStxUsdcxPlan(
  planId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_STX_USDCX_CONTRACT_ADDRESS,
    contractName: DCA_STX_USDCX_CONTRACT_NAME,
    functionName: "pause-plan",
    functionArgs: [uintCV(planId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export function resumeStxUsdcxPlan(
  planId: number,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  openContractCall({
    contractAddress: DCA_STX_USDCX_CONTRACT_ADDRESS,
    contractName: DCA_STX_USDCX_CONTRACT_NAME,
    functionName: "resume-plan",
    functionArgs: [uintCV(planId)],
    network: "mainnet",
    postConditionMode: 1,
    onFinish,
    onCancel,
  });
}

export { noneCV, principalCV };
