// Pure sBTC amount math + validation for Zest supply/withdraw. No I/O.
import { SBTC_DECIMALS } from "./contracts";

const FACTOR = 10 ** SBTC_DECIMALS; // 1e8

export function sbtcToSats(v: number): number {
  return Math.round(v * FACTOR);
}
export function satsToSbtc(v: number): number {
  return v / FACTOR;
}

/** Dust guard only; Zest enforces supply caps on-chain. */
export const MIN_SUPPLY_SATS = 1000;

export function validateSupplyAmount(
  amountSats: number,
  availableSats: number
): { ok: boolean; reason?: "zero" | "below-min" | "insufficient" } {
  if (!Number.isFinite(amountSats) || amountSats <= 0) return { ok: false, reason: "zero" };
  if (amountSats < MIN_SUPPLY_SATS) return { ok: false, reason: "below-min" };
  if (amountSats > availableSats) return { ok: false, reason: "insufficient" };
  return { ok: true };
}

export function validateWithdrawAmount(
  amountSats: number,
  suppliedSats: number
): { ok: boolean; reason?: "zero" | "exceeds-supplied" } {
  if (!Number.isFinite(amountSats) || amountSats <= 0) return { ok: false, reason: "zero" };
  if (amountSats > suppliedSats) return { ok: false, reason: "exceeds-supplied" };
  return { ok: true };
}

/** Zest a-tokens mint ~1:1 with the underlying at supply time. */
export function estimateZTokenReceived(amountSats: number): number {
  return amountSats;
}
