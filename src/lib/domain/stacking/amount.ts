// src/lib/domain/stacking/amount.ts
// Pure helpers for the staking flow. No fetch, no signing.

import { MIN_STAKE_USTX, FEE_BUFFER_USTX } from "./contracts";

/** STX (micro) eligible to stake: unlocked balance minus the fee buffer. */
export function idleStx(unlockedUstx: number): number {
  return Math.max(0, unlockedUstx - FEE_BUFFER_USTX);
}

export type StakeValidation =
  | { ok: true }
  | { ok: false; reason: "below-min" | "exceeds-balance" };

/** Validate a desired stake amount (micro-STX) against min + available idle balance. */
export function validateStakeAmount(amountUstx: number, availableUstx: number): StakeValidation {
  if (amountUstx < MIN_STAKE_USTX) return { ok: false, reason: "below-min" };
  if (amountUstx > availableUstx) return { ok: false, reason: "exceeds-balance" };
  return { ok: true };
}

/**
 * stSTX (micro) received for a STX deposit (micro), given
 * `stxPerStStxUstx` = micro-STX value of 1 stSTX (>= 1_000_000 since stSTX
 * appreciates against STX). Floored. Best-effort display only.
 */
export function estimateStStxReceived(stxAmountUstx: number, stxPerStStxUstx: number): number {
  if (stxPerStStxUstx <= 0) return 0;
  return Math.floor((stxAmountUstx * 1_000_000) / stxPerStStxUstx);
}
