// src/lib/direct-swap.ts
// Barrel — public API for the swap module. Consumers import from
// "@/lib/direct-swap"; the implementation lives under domain/, infra/, app/.
// See docs/superpowers/specs/2026-05-23-direct-swap-domain-extraction-design.md

export type { SwapToken } from "./domain/swap/tokens";
export {
  SWAP_TOKENS,
  SWAP_TOKEN_USD,
  SWAP_PRICE_GECKO_IDS,
} from "./domain/swap/tokens";

export type { SwapRoute } from "./domain/swap/routes";
export {
  getRoute,
  getValidDestinations,
  getSwappableFromTokens,
} from "./domain/swap/routes";

export {
  STX_GAS_RESERVE,
  toRawAmount,
  applySlippageFloor,
  sanitizeAmountInput,
  amountForPercent,
  exceedsBalance,
} from "./domain/swap/amount";

export {
  MIN_STX_FOR_FEE,
  minSwapHuman,
  isBelowMinSwap,
  lacksStxForFee,
  slippageWarning,
} from "./domain/swap/limits";

export type { QuoteResult } from "./domain/swap/quote-math";
export {
  quoteRate,
  computePriceImpact,
  QUOTE_TTL_MS,
  isQuoteStale,
  quoteSecondsLeft,
} from "./domain/swap/quote-math";

export { resolveUnitUsd, formatUsd } from "./domain/swap/usd";

export type { SwapParams } from "./domain/swap/clarity";
export { buildSwapParams } from "./domain/swap/clarity";

export { getQuote } from "./app/swap/quote";
