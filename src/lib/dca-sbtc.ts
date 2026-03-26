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
  Daily: 1300,
  Weekly: 9100,
  Monthly: 39000,
} as const;

export function blocksToInterval(blocks: number): string {
  // Current values
  if (blocks === 1300) return "Daily";
  if (blocks === 9100) return "Weekly";
  if (blocks === 39000) return "Monthly";
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
