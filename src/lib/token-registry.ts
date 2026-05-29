/**
 * Canonical token registry — single source of truth for token identity across
 * the Crypto Bubbles + price-alert surfaces. Before this existed, gecko ids,
 * swap ids, and contract mappings were duplicated across the bubbles route,
 * useHoldings, the bubble tooltip, and priceAlerts — and had drifted out of
 * sync (WELSH and stSTX carried dead CoinGecko ids, so their alerts never
 * fired). All gecko ids here are verified against the CoinGecko API.
 *
 * Ordering is cosmetic; consumers derive sets/maps, not positions.
 */
export interface TokenInfo {
  /** Canonical CoinGecko coin id (verified against the API). */
  geckoId: string;
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
   * On-chain SIP-010 contract used to match wallet holdings, as the lowercase
   * "principal.contract-name" Hiro returns. Only set for tokens we can detect
   * in a balance response; unset means "not matched in holdings".
   */
  contractId?: string;
  /** Token decimals — required alongside `contractId` for amount conversion. */
  decimals?: number;
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
    contractId: "sm3vdxk3wzzsa84xxfkafaf15nnzx32ctsg82jfq4.sbtc-token",
    decimals: 8,
  },
  {
    geckoId: "alexgo",
    symbol: "ALEX",
    name: "ALEX",
    bubbleStacks: true,
    alert: true,
  },
  {
    geckoId: "velar",
    symbol: "VELAR",
    name: "Velar",
    bubbleStacks: true,
    alert: true,
  },
  {
    geckoId: "welsh-corgi-coin",
    symbol: "WELSH",
    name: "Welsh Corgi",
    bubbleStacks: true,
    alert: true,
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
  },
];

/** Gecko ids force-included + badged as Stacks tokens in the bubbles view. */
export const STACKS_GECKO_IDS: string[] = TOKEN_REGISTRY.filter(
  (t) => t.bubbleStacks
).map((t) => t.geckoId);

const STACKS_GECKO_ID_SET = new Set(STACKS_GECKO_IDS);

/** Whether a CoinGecko id is a badged Stacks-ecosystem token in bubbles. */
export function isStacksGeckoId(geckoId: string): boolean {
  return STACKS_GECKO_ID_SET.has(geckoId);
}

/** Lowercase "principal.contract-name" → gecko id, for holdings matching. */
export const CONTRACT_TO_GECKO_ID: Record<string, string> = Object.fromEntries(
  TOKEN_REGISTRY.filter((t) => t.contractId).map((t) => [t.contractId!, t.geckoId])
);

/** Gecko id → token decimals, for holdings amount conversion. */
export const GECKO_ID_TO_DECIMALS: Record<string, number> = Object.fromEntries(
  TOKEN_REGISTRY.filter((t) => t.decimals != null).map((t) => [t.geckoId, t.decimals!])
);

/** Gecko id → swap-widget token id, for the bubble tooltip "Swap" CTA. */
export const GECKO_ID_TO_SWAP_ID: Record<string, "stx" | "sbtc"> = Object.fromEntries(
  TOKEN_REGISTRY.filter((t) => t.swapId).map((t) => [t.geckoId, t.swapId!])
);
