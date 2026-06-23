import { satsToSbtc } from "./amount";

export interface ZestPosition {
  asset: "sBTC";
  suppliedSats: number;
  suppliedSbtc: number;
}

/** Null when there is nothing supplied, so the UI hides an empty position. */
export function buildSbtcPosition(suppliedSats: number): ZestPosition | null {
  if (!Number.isFinite(suppliedSats) || suppliedSats <= 0) return null;
  return { asset: "sBTC", suppliedSats, suppliedSbtc: satsToSbtc(suppliedSats) };
}
