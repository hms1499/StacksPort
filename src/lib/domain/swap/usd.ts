// src/lib/domain/swap/usd.ts
// USD display helpers. Pure — consumes a price map provided by the caller.

import { SWAP_TOKEN_USD } from "./tokens";

/**
 * USD price of ONE unit of a swap token. `prices` is the CoinGecko
 * simple/price shape (`{ [geckoId]: { usd: number } }`). Returns `null`
 * when the price is unknown (token unmapped, id absent, not yet loaded, or
 * ≤ 0) so the UI can hide the figure instead of showing a misleading $0.
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
