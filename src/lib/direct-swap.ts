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

// Re-exports — public API surface remains "@/lib/direct-swap".
export type { SwapToken } from "./domain/swap/tokens";
export {
  SWAP_TOKENS,
  SWAP_TOKEN_USD,
  SWAP_PRICE_GECKO_IDS,
} from "./domain/swap/tokens";
export type { SwapRoute } from "./domain/swap/routes";
export {
  getRoute,
  getValidDestinations,
  getSwappableFromTokens,
} from "./domain/swap/routes";

// Internal — still used by quote/builder code that has not yet moved.
import { ROUTE_TABLE, getRoute, type QuoteHop, type SwapRoute } from "./domain/swap/routes";
import { SWAP_TOKENS, SWAP_TOKEN_USD } from "./domain/swap/tokens";
import { SBTC } from "./domain/swap/contracts";

// ─── Constants ───────────────────────────────────────────────────────────────

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

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
 * Whole seconds remaining before a quote taken at `quotedAt` auto-refreshes,
 * for the countdown UI. Clamped to `[0, QUOTE_TTL_MS/1000]` so clock skew
 * (now < quotedAt) can't show more than the full window, and an expired quote
 * reads 0 rather than negative.
 */
export function quoteSecondsLeft(
  quotedAt: number,
  now: number = Date.now()
): number {
  const secs = Math.ceil((QUOTE_TTL_MS - (now - quotedAt)) / 1000);
  return Math.min(QUOTE_TTL_MS / 1000, Math.max(0, secs));
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

/**
 * True when `amountIn` (a human decimal string) strictly exceeds
 * `balanceHuman`, compared in raw integer units — consistent with how every
 * other money comparison in this module works (via {@link toRawAmount}) and
 * immune to any decimal-precision edge. Caller must only pass a known balance.
 */
export function exceedsBalance(
  amountIn: string,
  balanceHuman: number,
  decimals: number
): boolean {
  return toRawAmount(amountIn, decimals) > toRawAmount(balanceHuman, decimals);
}

/**
 * Approximate STX kept free to pay a single swap contract-call fee. Below
 * this, a non-STX swap will likely revert for lack of fee. Heuristic, not a
 * fee estimate — intentionally avoids an extra RPC.
 */
export const MIN_STX_FOR_FEE = 0.05;

/**
 * True when the user spends a non-STX token and their STX balance is too low
 * to likely cover the transaction fee. Always false when the source IS STX —
 * the MAX gas-reserve logic (see {@link STX_GAS_RESERVE}) handles that path.
 */
export function lacksStxForFee(
  fromId: string,
  stxBalanceHuman: number
): boolean {
  if (fromId === "stx") return false;
  return stxBalanceHuman < MIN_STX_FOR_FEE;
}

// ─── USD valuation ───────────────────────────────────────────────────────────
// SWAP_TOKEN_USD and SWAP_PRICE_GECKO_IDS are re-exported from domain/swap/tokens.

/**
 * USD price of ONE unit of a swap token. `prices` is the CoinGecko
 * simple/price shape (`{ [geckoId]: { usd: number } }`). Returns `null` when
 * the price is unknown (token unmapped, id absent, not yet loaded, or ≤ 0) so
 * the UI can hide the figure instead of showing a misleading $0.
 */
export function resolveUnitUsd(
  tokenId: string,
  prices: Record<string, { usd: number }> | undefined
): number | null {
  const src = SWAP_TOKEN_USD[tokenId];
  if (!src) return null;
  if (src.geckoId === null) return src.fixedUsd ?? null;
  const usd = prices?.[src.geckoId]?.usd;
  return typeof usd === "number" && usd > 0 ? usd : null;
}

/**
 * Format a USD figure for display beside a swap amount. `null`/non-finite →
 * `null` (caller hides the line). A non-zero amount under a cent clamps to
 * "< $0.01" so it never renders as "$0.00".
 */
export function formatUsd(value: number | null): string | null {
  if (value === null || !isFinite(value)) return null;
  if (value === 0) return "$0.00";
  if (value > 0 && value < 0.01) return "< $0.01";
  return (
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
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

/**
 * One read-only quote hop. All cores (xyk/stableswap) expose the same
 * shape: `(get-dx|get-dy) pool xToken yToken uint` returning `(ok uint)`.
 * Replaces the former xykGetDy/xykGetDx/ssGetDy trio (identical bodies).
 */
async function quoteHop(hop: QuoteHop, amountInRaw: number): Promise<number> {
  const args = [
    cvToHex(contractPrincipalCV(hop.pool.address, hop.pool.name)),
    cvToHex(contractPrincipalCV(hop.xToken.address, hop.xToken.name)),
    cvToHex(contractPrincipalCV(hop.yToken.address, hop.yToken.name)),
    cvToHex(uintCV(amountInRaw)),
  ];
  const cv = await callReadOnly(
    hop.coreAddress,
    hop.coreName,
    hop.fn,
    args
  );
  return unwrapOkUint(cv);
}

export interface QuoteResult {
  amountOut: number;       // raw units (micro/sats)
  amountOutHuman: number;  // human-readable
  route: SwapRoute;
  quotedAt: number;        // Date.now() when fetched — see isQuoteStale
  priceImpact: number;     // fraction (0.05 = 5%); 0 if not computable
}

/** Raw output for a raw input: chains the route's quote hops, feeding each
 *  hop's output into the next. Reads the same ROUTE_TABLE as buildSwapParams. */
async function quoteRawOut(
  fromId: string,
  toId: string,
  amountInRaw: number
): Promise<number> {
  const spec = ROUTE_TABLE.find((r) => r.from === fromId && r.to === toId);
  if (!spec) throw new Error(`No quote logic for ${fromId} → ${toId}`);
  let amt = amountInRaw;
  for (const hop of spec.quote) {
    amt = await quoteHop(hop, amt);
  }
  return amt;
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
  const spec = ROUTE_TABLE.find((r) => r.from === fromId && r.to === toId);
  if (!spec) throw new Error(`No swap builder for ${fromId} → ${toId}`);

  const fromToken = SWAP_TOKENS.find((t) => t.id === fromId)!;
  const amountInRaw = toRawAmount(amountInHuman, fromToken.decimals);
  const postConditions = [
    senderSpendPostCondition(fromId, amountInRaw, senderAddress),
  ];

  const e = spec.exec;
  const functionArgs: ClarityValue[] =
    e.kind === "router"
      ? [
          uintCV(amountInRaw),
          uintCV(minAmountOutRaw),
          standardPrincipalCV(senderAddress),
        ]
      : [
          contractPrincipalCV(e.pool.address, e.pool.name),
          contractPrincipalCV(e.xToken.address, e.xToken.name),
          contractPrincipalCV(e.yToken.address, e.yToken.name),
          uintCV(amountInRaw),
          uintCV(minAmountOutRaw),
        ];

  return {
    contractAddress: e.contract.address,
    contractName: e.contract.name,
    functionName: e.fn,
    functionArgs,
    postConditions,
    postConditionMode: PostConditionMode.Deny,
  };
}
