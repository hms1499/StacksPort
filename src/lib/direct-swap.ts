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
export {
  STX_GAS_RESERVE,
  toRawAmount,
  applySlippageFloor,
  sanitizeAmountInput,
  amountForPercent,
  exceedsBalance,
} from "./domain/swap/amount";
export {
  MIN_STX_FOR_FEE,
  minSwapHuman,
  isBelowMinSwap,
  lacksStxForFee,
  slippageWarning,
} from "./domain/swap/limits";
export type { QuoteResult } from "./domain/swap/quote-math";
export {
  quoteRate,
  computePriceImpact,
  QUOTE_TTL_MS,
  isQuoteStale,
  quoteSecondsLeft,
} from "./domain/swap/quote-math";
export { resolveUnitUsd, formatUsd } from "./domain/swap/usd";

// Internal — still used by quote/builder code that has not yet moved.
import { ROUTE_TABLE, getRoute, type QuoteHop, type SwapRoute } from "./domain/swap/routes";
import { SWAP_TOKENS } from "./domain/swap/tokens";
import { SBTC } from "./domain/swap/contracts";
import { toRawAmount } from "./domain/swap/amount";
import { MIN_SWAP_RAW } from "./domain/swap/limits";
import { computePriceImpact } from "./domain/swap/quote-math";
import type { QuoteResult } from "./domain/swap/quote-math";

// ─── Constants ───────────────────────────────────────────────────────────────

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

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
