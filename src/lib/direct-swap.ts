// src/lib/direct-swap.ts
import {
  contractPrincipalCV,
  standardPrincipalCV,
  uintCV,
  serializeCV,
  hexToCV,
  ClarityType,
  Pc,
  PostConditionMode,
  type PostCondition,
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

/**
 * Sanitize a raw `<input>` value into a safe decimal string: digits and a
 * single dot only (no `e`/`+`/`-`/exponent/locale separators), fraction
 * truncated to the token's decimals. Keeps the amount field from ever
 * holding a value the contract math can't represent.
 */
export function sanitizeAmountInput(raw: string, decimals: number): string {
  if (!raw) return "";
  let s = raw.replace(/[^0-9.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s =
      s.slice(0, firstDot + 1) +
      s.slice(firstDot + 1).replace(/\./g, "");
  }
  if (s.startsWith(".")) s = "0" + s;
  const dot = s.indexOf(".");
  if (dot !== -1 && decimals >= 0) {
    s = s.slice(0, dot + 1 + decimals);
  }
  return s;
}

/**
 * Classify a slippage tolerance (percent). Above 5% the user risks a bad
 * fill / MEV; below 0.05% the swap will likely revert on any price move.
 * `null` means the value is in the sensible range.
 */
export function slippageWarning(pct: number): "high" | "low" | null {
  if (pct > 5) return "high";
  if (pct < 0.05) return "low";
  return null;
}

/**
 * Effective exchange rate from a quote: how much output 1 unit of input
 * buys. Display-only (a ratio is fine as a float). 0 if not computable.
 */
export function quoteRate(
  amountInHuman: number,
  amountOutHuman: number
): number {
  if (!(amountInHuman > 0) || !(amountOutHuman > 0)) return 0;
  return amountOutHuman / amountInHuman;
}

// ─── Money Math (BigInt — never float) ───────────────────────────────────────

/**
 * Convert a human-readable amount to raw integer units without float math.
 * `1.5` STX → `1500000n`. Fraction beyond `decimals` is truncated (floor),
 * matching on-chain behaviour. Float `human * 10**decimals` loses precision
 * for 8-decimal tokens with large integer parts — this does not.
 */
export function toRawAmount(human: string | number, decimals: number): bigint {
  const str = typeof human === "number" ? human.toFixed(decimals) : human.trim();
  if (!str || isNaN(Number(str))) return 0n;
  const neg = str.startsWith("-");
  const [intPart, fracPart = ""] = str.replace(/^[+-]/, "").split(".");
  const frac = fracPart.slice(0, decimals).padEnd(decimals, "0");
  const raw = BigInt((intPart || "0") + frac);
  return neg ? -raw : raw;
}

/**
 * Apply a slippage tolerance (percent) to a raw output amount, flooring.
 * `applySlippageFloor(1000000n, 0.5)` → `995000n`. Uses basis points so
 * fractional percents stay exact.
 */
export function applySlippageFloor(
  amountOutRaw: bigint,
  slippagePercent: number
): bigint {
  const bps = BigInt(Math.round(slippagePercent * 100));
  return (amountOutRaw * (10000n - bps)) / 10000n;
}

/**
 * STX kept back when the user taps MAX, so the swap transaction can still
 * pay its contract-call fee. Native STX is both the asset being spent and
 * the fee currency — without this buffer a 100% STX swap always reverts.
 */
export const STX_GAS_RESERVE = 0.1;

/**
 * Smart-contract minimum swap size, in raw units, keyed by source token.
 * Submitting below this reverts on-chain and wastes the user's tx fee, so
 * the UI must block it first. (1 STX / 334 sats sBTC.)
 */
const MIN_SWAP_RAW: Record<string, bigint> = {
  stx: 1_000_000n, // 1 STX
  sbtc: 334n, // 334 sats
};

/** Human-readable minimum swap amount for a source token (0 if unconstrained). */
export function minSwapHuman(fromId: string): number {
  const raw = MIN_SWAP_RAW[fromId];
  if (raw === undefined) return 0;
  const token = SWAP_TOKENS.find((t) => t.id === fromId);
  return Number(raw) / Math.pow(10, token?.decimals ?? 0);
}

/** True when `amountInHuman` is below the contract minimum for `fromId`. */
export function isBelowMinSwap(
  fromId: string,
  amountInHuman: string | number
): boolean {
  const min = MIN_SWAP_RAW[fromId];
  if (min === undefined) return false;
  const token = SWAP_TOKENS.find((t) => t.id === fromId);
  const raw = toRawAmount(amountInHuman, token?.decimals ?? 0);
  return raw < min;
}

/**
 * Price impact as a fraction (0.05 = 5%): how much worse the user's effective
 * rate is than the near-spot rate from a tiny reference trade. Larger trades
 * move the pool more, so this grows with size. Returns 0 if it can't be
 * computed or if the effective rate is somehow better than spot.
 */
export function computePriceImpact(
  refAmountInRaw: number,
  refAmountOutRaw: number,
  amountInRaw: number,
  amountOutRaw: number
): number {
  if (
    refAmountInRaw <= 0 ||
    refAmountOutRaw <= 0 ||
    amountInRaw <= 0 ||
    amountOutRaw <= 0
  ) {
    return 0;
  }
  const spotRate = refAmountOutRaw / refAmountInRaw;
  const effectiveRate = amountOutRaw / amountInRaw;
  return Math.max(0, 1 - effectiveRate / spotRate);
}

/** A quote older than this is considered stale and must be refreshed. */
export const QUOTE_TTL_MS = 30_000;

/** True once a quote taken at `quotedAt` has aged past {@link QUOTE_TTL_MS}. */
export function isQuoteStale(quotedAt: number, now: number = Date.now()): boolean {
  return now - quotedAt > QUOTE_TTL_MS;
}

/**
 * Amount (human string) to put in the input when a balance-percent shortcut
 * is tapped. For a native-STX MAX it subtracts the gas reserve; everything
 * else is a straight `balance * pct`. Result is capped at 6 decimals.
 */
export function amountForPercent(
  balance: number,
  pct: number,
  isNativeStx: boolean,
  decimals: number
): string {
  let val = balance * pct;
  if (isNativeStx && pct >= 1) {
    val = Math.max(balance - STX_GAS_RESERVE, 0);
  }
  const places = Math.min(decimals, 6);
  return parseFloat(val.toFixed(places)).toString();
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
  quotedAt: number;        // Date.now() when fetched — see isQuoteStale
  priceImpact: number;     // fraction (0.05 = 5%); 0 if not computable
}

/** Raw output for a raw input on a given route (the per-route hop logic). */
async function quoteRawOut(
  fromId: string,
  toId: string,
  amountInRaw: number
): Promise<number> {
  if (fromId === "stx" && toId === "sbtc") {
    // STX → sBTC: get-dx on sbtc-stx pool (y=STX input → x=sBTC output)
    return xykGetDx(POOL_SBTC_STX, SBTC, WSTX, amountInRaw);
  }
  if (fromId === "sbtc" && toId === "stx") {
    // sBTC → STX: get-dy on sbtc-stx pool (x=sBTC input → y=STX output)
    return xykGetDy(POOL_SBTC_STX, SBTC, WSTX, amountInRaw);
  }
  if (fromId === "sbtc" && toId === "usdcx") {
    // sBTC → USDCx: 3 hops
    const stxOut = await xykGetDy(POOL_SBTC_STX, SBTC, WSTX, amountInRaw);
    const aeUsdcOut = await xykGetDy(POOL_STX_AEUSDC, WSTX, AEUSDC, stxOut);
    return ssGetDy(POOL_AEUSDC_USDCX, AEUSDC, USDCX, aeUsdcOut);
  }
  throw new Error(`No quote logic for ${fromId} → ${toId}`);
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
  const amountInRaw = Number(toRawAmount(amountInHuman, fromToken.decimals));

  // A tiny reference trade (the contract minimum) approximates the spot rate,
  // so we can show how much the user's size moves the price. Fetched in
  // parallel with the real quote.
  const refInRaw = Number(MIN_SWAP_RAW[fromId] ?? 0n);
  const [amountOutRaw, refOutRaw] = await Promise.all([
    quoteRawOut(fromId, toId, amountInRaw),
    refInRaw > 0 && refInRaw < amountInRaw
      ? quoteRawOut(fromId, toId, refInRaw).catch(() => 0)
      : Promise.resolve(0),
  ]);

  return {
    amountOut: amountOutRaw,
    amountOutHuman: amountOutRaw / Math.pow(10, toToken.decimals),
    route,
    quotedAt: Date.now(),
    priceImpact: computePriceImpact(
      refInRaw,
      refOutRaw,
      amountInRaw,
      amountOutRaw
    ),
  };
}

// ─── Swap Param Builder ──────────────────────────────────────────────────────

export interface SwapParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditions: PostCondition[];
  postConditionMode: PostConditionMode;
}

const SBTC_ASSET = `${SBTC.address}.${SBTC.name}` as const;

/**
 * Post-condition guaranteeing the sender parts with EXACTLY `amountInRaw` of
 * the input token and nothing else of theirs leaves the wallet. Combined with
 * Deny mode this closes the catastrophic "contract drains more than expected"
 * vector. The minimum received amount is enforced on-chain by the swap's
 * `min-amount-out` argument, which reverts the tx if the output is too low.
 */
function senderSpendPostCondition(
  fromId: string,
  amountInRaw: bigint,
  senderAddress: string
): PostCondition {
  if (fromId === "stx") {
    return Pc.principal(senderAddress).willSendEq(amountInRaw).ustx();
  }
  if (fromId === "sbtc") {
    return Pc.principal(senderAddress)
      .willSendEq(amountInRaw)
      .ft(SBTC_ASSET, SBTC.name);
  }
  throw new Error(`No post-condition rule for input token ${fromId}`);
}

export function buildSwapParams(
  fromId: string,
  toId: string,
  amountInHuman: string | number,
  minAmountOutRaw: bigint | number,
  senderAddress: string
): SwapParams {
  const fromToken = SWAP_TOKENS.find((t) => t.id === fromId)!;
  const amountInRaw = toRawAmount(amountInHuman, fromToken.decimals);
  const postConditions = [
    senderSpendPostCondition(fromId, amountInRaw, senderAddress),
  ];

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
      postConditions,
      postConditionMode: PostConditionMode.Deny,
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
      postConditions,
      postConditionMode: PostConditionMode.Deny,
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
      postConditions,
      postConditionMode: PostConditionMode.Deny,
    };
  }

  throw new Error(`No swap builder for ${fromId} → ${toId}`);
}
