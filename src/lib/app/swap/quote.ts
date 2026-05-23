// src/lib/app/swap/quote.ts
// Orchestrator: composes domain rules (route table, raw-unit math, price
// impact) with the infra read-only adapter to produce a swap quote.

import { contractPrincipalCV, uintCV } from "@stacks/transactions";

import { toRawAmount } from "@/lib/domain/swap/amount";
import { cvToHex, unwrapOkUint } from "@/lib/domain/swap/clarity";
import { MIN_SWAP_RAW } from "@/lib/domain/swap/limits";
import {
  computePriceImpact,
  type QuoteResult,
} from "@/lib/domain/swap/quote-math";
import {
  ROUTE_TABLE,
  getRoute,
  type QuoteHop,
} from "@/lib/domain/swap/routes";
import { SWAP_TOKENS } from "@/lib/domain/swap/tokens";
import { callReadOnly } from "@/lib/infra/stacks/read-only";

/**
 * One read-only quote hop. All cores (xyk/stableswap) expose the same
 * shape: `(get-dx|get-dy) pool xToken yToken uint` returning `(ok uint)`.
 */
async function quoteHop(hop: QuoteHop, amountInRaw: number): Promise<number> {
  const args = [
    cvToHex(contractPrincipalCV(hop.pool.address, hop.pool.name)),
    cvToHex(contractPrincipalCV(hop.xToken.address, hop.xToken.name)),
    cvToHex(contractPrincipalCV(hop.yToken.address, hop.yToken.name)),
    cvToHex(uintCV(amountInRaw)),
  ];
  const cv = await callReadOnly(hop.coreAddress, hop.coreName, hop.fn, args);
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

  // A tiny reference trade (the contract minimum) approximates the spot
  // rate, so we can show how much the user's size moves the price. Fetched
  // in parallel with the real quote.
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
