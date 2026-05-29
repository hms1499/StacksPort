/**
 * Canonical token registry — single source of truth for token identity across
 * the Crypto Bubbles + price-alert + portfolio-valuation surfaces. Before this
 * existed, gecko ids, swap ids, decimals, and contract mappings were duplicated
 * across the bubbles route, useHoldings, the bubble tooltip, priceAlerts,
 * stacks.ts, and the extension summary route — and had drifted out of sync
 * (WELSH and stSTX carried dead CoinGecko ids, so their alerts never fired and
 * their holdings were valued at $0). All gecko ids here are verified against
 * the CoinGecko API.
 *
 * Ordering is cosmetic; consumers derive sets/maps, not positions.
 */
export interface TokenInfo {
  /** Canonical CoinGecko coin id, or null for tokens with no feed (fixed-price). */
  geckoId: string | null;
  /** Uppercase ticker. */
  symbol: string;
  /** Display name. */
  name: string;
  /**
   * Part of the Stacks-ecosystem set force-included + badged in the Crypto
   * Bubbles "Stacks" scope. Mirrors the legacy STACKS_TOKEN_IDS membership.
   */
  bubbleStacks: boolean;
  /** Surfaced in the curated price-alert token picker. */
  alert: boolean;
  /** Swap-widget token id when tradeable on Bitflow via our /trade route. */
  swapId?: "stx" | "sbtc";
  /**
   * SIP-010 contract name (the part between "." and "::") — keys the portfolio
   * valuation map. Set for every token with an on-chain contract.
   */
  contractName?: string;
  /**
   * Full lowercase "principal.contract-name" Hiro returns — keys wallet-holdings
   * matching (useHoldings). Only set for tokens we currently detect in a balance
   * response; unset means "not matched in holdings".
   */
  contractId?: string;
  /** Token decimals — required when contractName/contractId is set. */
  decimals?: number;
  /** USD price for tokens with no CoinGecko feed (e.g. pegged stablecoins). */
  fixedUsdPrice?: number;
  /**
   * Override gecko id used for portfolio valuation only. sBTC is valued via the
   * deep, reliable BTC feed (1:1 peg) while its own identity stays `sbtc-2` for
   * the bubbles/holdings/swap surfaces. Defaults to `geckoId`.
   */
  valuationGeckoId?: string;
}

export const TOKEN_REGISTRY: TokenInfo[] = [
  {
    geckoId: "blockstack",
    symbol: "STX",
    name: "Stacks",
    bubbleStacks: true,
    alert: true,
    swapId: "stx",
  },
  {
    geckoId: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    bubbleStacks: false,
    alert: true,
  },
  {
    geckoId: "sbtc-2",
    symbol: "sBTC",
    name: "sBTC",
    bubbleStacks: true,
    alert: false,
    swapId: "sbtc",
    contractName: "sbtc-token",
    contractId: "sm3vdxk3wzzsa84xxfkafaf15nnzx32ctsg82jfq4.sbtc-token",
    decimals: 8,
    valuationGeckoId: "bitcoin",
  },
  {
    geckoId: "alexgo",
    symbol: "ALEX",
    name: "ALEX",
    bubbleStacks: true,
    alert: true,
    contractName: "age000-governance-token",
    decimals: 8,
  },
  {
    geckoId: "velar",
    symbol: "VELAR",
    name: "Velar",
    bubbleStacks: true,
    alert: true,
    contractName: "velar-token",
    decimals: 6,
  },
  {
    geckoId: "welsh-corgi-coin",
    symbol: "WELSH",
    name: "Welsh Corgi",
    bubbleStacks: true,
    alert: true,
    contractName: "welshcorgicoin-token",
    decimals: 6,
  },
  {
    geckoId: "hermetica-usdh",
    symbol: "USDH",
    name: "Hermetica USDh",
    bubbleStacks: true,
    alert: false,
  },
  {
    geckoId: "stacking-dao",
    symbol: "stSTX",
    name: "Staked STX",
    bubbleStacks: false,
    alert: true,
    contractName: "ststx-token",
    decimals: 6,
  },
  {
    // USDCx — bridged USDC on Stacks. Pegged 1:1, valued at a fixed price
    // instead of a CoinGecko lookup.
    geckoId: null,
    symbol: "USDCx",
    name: "USDCx",
    bubbleStacks: false,
    alert: false,
    contractName: "usdcx",
    decimals: 6,
    fixedUsdPrice: 1,
  },
];

/** Gecko ids force-included + badged as Stacks tokens in the bubbles view. */
export const STACKS_GECKO_IDS: string[] = TOKEN_REGISTRY.filter(
  (t) => t.bubbleStacks && t.geckoId
).map((t) => t.geckoId!);

const STACKS_GECKO_ID_SET = new Set(STACKS_GECKO_IDS);

/** Whether a CoinGecko id is a badged Stacks-ecosystem token in bubbles. */
export function isStacksGeckoId(geckoId: string): boolean {
  return STACKS_GECKO_ID_SET.has(geckoId);
}

/** Lowercase "principal.contract-name" → gecko id, for holdings matching. */
export const CONTRACT_TO_GECKO_ID: Record<string, string> = Object.fromEntries(
  TOKEN_REGISTRY.filter((t) => t.contractId && t.geckoId).map((t) => [
    t.contractId!,
    t.geckoId!,
  ])
);

/** Gecko id → token decimals, for holdings amount conversion. */
export const GECKO_ID_TO_DECIMALS: Record<string, number> = Object.fromEntries(
  TOKEN_REGISTRY.filter((t) => t.geckoId && t.decimals != null).map((t) => [
    t.geckoId!,
    t.decimals!,
  ])
);

/** Gecko id → swap-widget token id, for the bubble tooltip "Swap" CTA. */
export const GECKO_ID_TO_SWAP_ID: Record<string, "stx" | "sbtc"> = Object.fromEntries(
  TOKEN_REGISTRY.filter((t) => t.swapId && t.geckoId).map((t) => [
    t.geckoId!,
    t.swapId!,
  ])
);

/**
 * SIP-010 contract name → { geckoId, decimals, fixedUsdPrice? } for portfolio
 * valuation. `geckoId` here is the valuation feed (sBTC resolves to the BTC
 * feed via `valuationGeckoId`); null means use `fixedUsdPrice`.
 */
export const CONTRACT_NAME_TO_GECKO: Record<
  string,
  { geckoId: string | null; decimals: number; fixedUsdPrice?: number }
> = Object.fromEntries(
  TOKEN_REGISTRY.filter((t) => t.contractName).map((t) => [
    t.contractName!,
    {
      geckoId: t.valuationGeckoId ?? t.geckoId,
      decimals: t.decimals!,
      ...(t.fixedUsdPrice != null ? { fixedUsdPrice: t.fixedUsdPrice } : {}),
    },
  ])
);
