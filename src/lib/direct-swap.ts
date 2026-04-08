// src/lib/direct-swap.ts
import {
  contractPrincipalCV,
  standardPrincipalCV,
  uintCV,
  serializeCV,
  hexToCV,
  ClarityType,
  type ClarityValue,
} from "@stacks/transactions";

// ─── Constants ───────────────────────────────────────────────────────────────

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

// XYK Core
const XYK_CORE_ADDRESS = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const XYK_CORE_NAME = "xyk-core-v-1-2";

// Pools
const POOL_SBTC_STX = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "xyk-pool-sbtc-stx-v-1-1" };
const POOL_STX_AEUSDC = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "xyk-pool-stx-aeusdc-v-1-2" };
const POOL_AEUSDC_USDCX = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "stableswap-pool-aeusdc-usdcx-v-1-1" };

// Stableswap Core
const SS_CORE_ADDRESS = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const SS_CORE_NAME = "stableswap-core-v-1-4";

// Routers
const ROUTER_STX_SBTC = { address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV", name: "bitflow-sbtc-swap-router" };
const ROUTER_SBTC_USDCX = { address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV", name: "bitflow-usdcx-swap-router" };

// Token contracts
const SBTC = { address: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", name: "sbtc-token" };
const WSTX = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "token-stx-v-1-2" };
const AEUSDC = { address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", name: "token-aeusdc" };
const USDCX = { address: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE", name: "usdcx" };

// ─── Token Registry ──────────────────────────────────────────────────────────

export interface SwapToken {
  id: string;
  symbol: string;
  name: string;
  contract: string | null; // null for native STX
  decimals: number;
  icon: string;
}

export const SWAP_TOKENS: SwapToken[] = [
  { id: "stx", symbol: "STX", name: "Stacks", contract: null, decimals: 6, icon: "/tokens/stx.svg" },
  { id: "sbtc", symbol: "sBTC", name: "sBTC", contract: `${SBTC.address}.${SBTC.name}`, decimals: 8, icon: "/tokens/sbtc.svg" },
  { id: "usdcx", symbol: "USDCx", name: "USD Coin", contract: `${USDCX.address}.${USDCX.name}`, decimals: 6, icon: "/tokens/usdcx.svg" },
];

// ─── Route Resolver ──────────────────────────────────────────────────────────

export type SwapRoute = {
  from: string;
  to: string;
  method: "router" | "direct";
  hops: string[];
};

const ROUTES: SwapRoute[] = [
  { from: "stx", to: "sbtc", method: "router", hops: ["STX", "sBTC"] },
  { from: "sbtc", to: "stx", method: "direct", hops: ["sBTC", "STX"] },
  { from: "sbtc", to: "usdcx", method: "router", hops: ["sBTC", "STX", "aeUSDC", "USDCx"] },
];

export function getRoute(fromId: string, toId: string): SwapRoute | null {
  return ROUTES.find((r) => r.from === fromId && r.to === toId) ?? null;
}

export function getValidDestinations(fromId: string): SwapToken[] {
  const validIds = ROUTES.filter((r) => r.from === fromId).map((r) => r.to);
  return SWAP_TOKENS.filter((t) => validIds.includes(t.id));
}

export function getSwappableFromTokens(): SwapToken[] {
  const fromIds = [...new Set(ROUTES.map((r) => r.from))];
  return SWAP_TOKENS.filter((t) => fromIds.includes(t.id));
}

// ─── Clarity Helpers ─────────────────────────────────────────────────────────

function cvToHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result as Uint8Array).toString("hex");
}

function unwrapOkUint(cv: ClarityValue): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = cv as any;

  // String-based type (newer @stacks/transactions)
  if (raw.type === "ok") return Number(raw.value?.value ?? raw.value ?? 0);

  // Enum-based type (legacy)
  if (raw.type === ClarityType.ResponseOk) return Number(raw.value?.value ?? 0);

  throw new Error("Unexpected Clarity value type");
}

async function callReadOnly(
  contractAddress: string,
  contractName: string,
  functionName: string,
  args: string[]
): Promise<ClarityValue> {
  const res = await fetch(
    `${HIRO_API}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
    }
  );
  const data = await res.json();
  if (!data.okay) throw new Error(data.cause ?? "Read-only call failed");
  return hexToCV(data.result);
}

// ─── Quote Fetcher ───────────────────────────────────────────────────────────

async function xykGetDy(
  pool: { address: string; name: string },
  xToken: { address: string; name: string },
  yToken: { address: string; name: string },
  xAmount: number
): Promise<number> {
  const args = [
    cvToHex(contractPrincipalCV(pool.address, pool.name)),
    cvToHex(contractPrincipalCV(xToken.address, xToken.name)),
    cvToHex(contractPrincipalCV(yToken.address, yToken.name)),
    cvToHex(uintCV(xAmount)),
  ];
  const cv = await callReadOnly(XYK_CORE_ADDRESS, XYK_CORE_NAME, "get-dy", args);
  return unwrapOkUint(cv);
}

async function xykGetDx(
  pool: { address: string; name: string },
  xToken: { address: string; name: string },
  yToken: { address: string; name: string },
  yAmount: number
): Promise<number> {
  const args = [
    cvToHex(contractPrincipalCV(pool.address, pool.name)),
    cvToHex(contractPrincipalCV(xToken.address, xToken.name)),
    cvToHex(contractPrincipalCV(yToken.address, yToken.name)),
    cvToHex(uintCV(yAmount)),
  ];
  const cv = await callReadOnly(XYK_CORE_ADDRESS, XYK_CORE_NAME, "get-dx", args);
  return unwrapOkUint(cv);
}

async function ssGetDy(
  pool: { address: string; name: string },
  xToken: { address: string; name: string },
  yToken: { address: string; name: string },
  xAmount: number
): Promise<number> {
  const args = [
    cvToHex(contractPrincipalCV(pool.address, pool.name)),
    cvToHex(contractPrincipalCV(xToken.address, xToken.name)),
    cvToHex(contractPrincipalCV(yToken.address, yToken.name)),
    cvToHex(uintCV(xAmount)),
  ];
  const cv = await callReadOnly(SS_CORE_ADDRESS, SS_CORE_NAME, "get-dy", args);
  return unwrapOkUint(cv);
}

export interface QuoteResult {
  amountOut: number;       // raw units (micro/sats)
  amountOutHuman: number;  // human-readable
  route: SwapRoute;
}

export async function getQuote(
  fromId: string,
  toId: string,
  amountInHuman: number
): Promise<QuoteResult> {
  const route = getRoute(fromId, toId);
  if (!route) throw new Error(`No route for ${fromId} → ${toId}`);

  const fromToken = SWAP_TOKENS.find((t) => t.id === fromId)!;
  const toToken = SWAP_TOKENS.find((t) => t.id === toId)!;
  const amountInRaw = Math.floor(amountInHuman * Math.pow(10, fromToken.decimals));

  let amountOutRaw: number;

  if (fromId === "stx" && toId === "sbtc") {
    // STX → sBTC: get-dx on sbtc-stx pool (y=STX input → x=sBTC output)
    amountOutRaw = await xykGetDx(POOL_SBTC_STX, SBTC, WSTX, amountInRaw);
  } else if (fromId === "sbtc" && toId === "stx") {
    // sBTC → STX: get-dy on sbtc-stx pool (x=sBTC input → y=STX output)
    amountOutRaw = await xykGetDy(POOL_SBTC_STX, SBTC, WSTX, amountInRaw);
  } else if (fromId === "sbtc" && toId === "usdcx") {
    // sBTC → USDCx: 3 hops
    const stxOut = await xykGetDy(POOL_SBTC_STX, SBTC, WSTX, amountInRaw);
    const aeUsdcOut = await xykGetDy(POOL_STX_AEUSDC, WSTX, AEUSDC, stxOut);
    amountOutRaw = await ssGetDy(POOL_AEUSDC_USDCX, AEUSDC, USDCX, aeUsdcOut);
  } else {
    throw new Error(`No quote logic for ${fromId} → ${toId}`);
  }

  return {
    amountOut: amountOutRaw,
    amountOutHuman: amountOutRaw / Math.pow(10, toToken.decimals),
    route,
  };
}

// ─── Swap Param Builder ──────────────────────────────────────────────────────

export interface SwapParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditionMode: number; // 1 = Allow
}

export function buildSwapParams(
  fromId: string,
  toId: string,
  amountInHuman: number,
  minAmountOutRaw: number,
  senderAddress: string
): SwapParams {
  const fromToken = SWAP_TOKENS.find((t) => t.id === fromId)!;
  const amountInRaw = Math.floor(amountInHuman * Math.pow(10, fromToken.decimals));

  if (fromId === "stx" && toId === "sbtc") {
    // STX → sBTC via router
    return {
      contractAddress: ROUTER_STX_SBTC.address,
      contractName: ROUTER_STX_SBTC.name,
      functionName: "swap-stx-for-token",
      functionArgs: [
        uintCV(amountInRaw),
        uintCV(minAmountOutRaw),
        standardPrincipalCV(senderAddress),
      ],
      postConditionMode: 1,
    };
  }

  if (fromId === "sbtc" && toId === "stx") {
    // sBTC → STX via direct xyk-core swap-x-for-y
    return {
      contractAddress: XYK_CORE_ADDRESS,
      contractName: XYK_CORE_NAME,
      functionName: "swap-x-for-y",
      functionArgs: [
        contractPrincipalCV(POOL_SBTC_STX.address, POOL_SBTC_STX.name),
        contractPrincipalCV(SBTC.address, SBTC.name),
        contractPrincipalCV(WSTX.address, WSTX.name),
        uintCV(amountInRaw),
        uintCV(minAmountOutRaw),
      ],
      postConditionMode: 1,
    };
  }

  if (fromId === "sbtc" && toId === "usdcx") {
    // sBTC → USDCx via router (3-hop)
    return {
      contractAddress: ROUTER_SBTC_USDCX.address,
      contractName: ROUTER_SBTC_USDCX.name,
      functionName: "swap-sbtc-for-token",
      functionArgs: [
        uintCV(amountInRaw),
        uintCV(minAmountOutRaw),
        standardPrincipalCV(senderAddress),
      ],
      postConditionMode: 1,
    };
  }

  throw new Error(`No swap builder for ${fromId} → ${toId}`);
}
