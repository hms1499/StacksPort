// src/lib/domain/swap/tokens.ts
// User-facing swap token registry + USD price source mapping. Pure data.

import { SBTC, USDCX } from "./contracts";

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

// ─── USD valuation ─────────────────────────────────────────────────────────
// Maps each swap token to its USD price source. geckoId = CoinGecko id used
// by the existing /api/coingecko proxy; fixedUsd = stablecoin pegged to $1
// (no fetch). IDs reuse the verified mapping already in lib/stacks.ts — not
// guessed.

export const SWAP_TOKEN_USD: Record<
  string,
  { geckoId: string | null; fixedUsd?: number }
> = {
  stx: { geckoId: "blockstack" },
  sbtc: { geckoId: "bitcoin" },
  usdcx: { geckoId: null, fixedUsd: 1 },
};

/** Deduped, non-null CoinGecko ids that must be fetched to price swap tokens. */
export const SWAP_PRICE_GECKO_IDS: string[] = [
  ...new Set(
    Object.values(SWAP_TOKEN_USD)
      .map((s) => s.geckoId)
      .filter((id): id is string => id !== null)
  ),
];
