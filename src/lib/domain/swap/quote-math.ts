// src/lib/domain/swap/quote-math.ts
// Pure quote-derived math: rate, price impact, staleness. No I/O.

import type { SwapRoute } from "./routes";

export interface QuoteResult {
  amountOut: number;       // raw units (micro/sats)
  amountOutHuman: number;  // human-readable
  route: SwapRoute;
  quotedAt: number;        // Date.now() when fetched — see isQuoteStale
  priceImpact: number;     // fraction (0.05 = 5%); 0 if not computable
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

/**
 * Price impact as a fraction (0.05 = 5%): how much worse the user's
 * effective rate is than the near-spot rate from a tiny reference trade.
 * Returns 0 if it can't be computed or if the effective rate is somehow
 * better than spot.
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
 * (now < quotedAt) can't show more than the full window, and an expired
 * quote reads 0 rather than negative.
 */
export function quoteSecondsLeft(
  quotedAt: number,
  now: number = Date.now()
): number {
  const secs = Math.ceil((QUOTE_TTL_MS - (now - quotedAt)) / 1000);
  return Math.min(QUOTE_TTL_MS / 1000, Math.max(0, secs));
}
