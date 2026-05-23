// src/lib/domain/swap/limits.ts
// Constraints the on-chain swap will enforce — surface them in the UI so the
// user can't burn fees on a guaranteed revert.

import { SWAP_TOKENS } from "./tokens";
import { toRawAmount } from "./amount";

/**
 * Smart-contract minimum swap size, in raw units, keyed by source token.
 * Submitting below this reverts on-chain and wastes the user's tx fee, so
 * the UI must block it first. (1 STX / 334 sats sBTC.)
 */
export const MIN_SWAP_RAW: Record<string, bigint> = {
  stx: 1_000_000n, // 1 STX
  sbtc: 334n, // 334 sats
};

/**
 * Approximate STX kept free to pay a single swap contract-call fee. Below
 * this, a non-STX swap will likely revert for lack of fee. Heuristic, not a
 * fee estimate — intentionally avoids an extra RPC.
 */
export const MIN_STX_FOR_FEE = 0.05;

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
 * True when the user spends a non-STX token and their STX balance is too low
 * to likely cover the transaction fee. Always false when the source IS STX —
 * the MAX gas-reserve logic handles that path.
 */
export function lacksStxForFee(
  fromId: string,
  stxBalanceHuman: number
): boolean {
  if (fromId === "stx") return false;
  return stxBalanceHuman < MIN_STX_FOR_FEE;
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
