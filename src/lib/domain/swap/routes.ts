// src/lib/domain/swap/routes.ts
// Data-driven route table: single source of truth for every quote + exec
// wiring. Adding a pair is a data change; a missing field is a compile error
// (not a runtime crash at sign time).

import {
  AEUSDC,
  POOL_AEUSDC_USDCX,
  POOL_SBTC_STX,
  POOL_STX_AEUSDC,
  ROUTER_SBTC_USDCX,
  SBTC,
  SS_CORE_ADDRESS,
  SS_CORE_NAME,
  USDCX,
  WSTX,
  XYK_CORE,
  XYK_CORE_ADDRESS,
  XYK_CORE_NAME,
  type TokenRef,
} from "./contracts";
import { SWAP_TOKENS, type SwapToken } from "./tokens";

export type SwapRoute = {
  from: string;
  to: string;
  method: "router" | "direct";
  hops: string[];
};

/** One read-only hop. Read args are always [pool, xToken, yToken, uint(amt)];
 *  the output feeds the next hop's amount. */
export interface QuoteHop {
  coreAddress: string;
  coreName: string;
  fn: "get-dx" | "get-dy";
  pool: TokenRef;
  xToken: TokenRef;
  yToken: TokenRef;
}

/** How the swap is executed on-chain. `router` = aggregator entrypoint
 *  (amount, minOut, sender); `direct` = raw xyk-core (pool+tokens, amount,
 *  minOut). */
export type ExecSpec =
  | { kind: "router"; contract: TokenRef; fn: string }
  | {
      kind: "direct";
      contract: TokenRef;
      fn: string;
      pool: TokenRef;
      xToken: TokenRef;
      yToken: TokenRef;
    };

export interface RouteSpec extends SwapRoute {
  quote: QuoteHop[];
  exec: ExecSpec;
}

export const ROUTE_TABLE: RouteSpec[] = [
  {
    from: "stx",
    to: "sbtc",
    method: "direct",
    hops: ["STX", "sBTC"],
    quote: [
      {
        coreAddress: XYK_CORE_ADDRESS,
        coreName: XYK_CORE_NAME,
        fn: "get-dx",
        pool: POOL_SBTC_STX,
        xToken: SBTC,
        yToken: WSTX,
      },
    ],
    exec: {
      kind: "direct",
      contract: XYK_CORE,
      fn: "swap-y-for-x",
      pool: POOL_SBTC_STX,
      xToken: SBTC,
      yToken: WSTX,
    },
  },
  {
    from: "sbtc",
    to: "stx",
    method: "direct",
    hops: ["sBTC", "STX"],
    quote: [
      {
        coreAddress: XYK_CORE_ADDRESS,
        coreName: XYK_CORE_NAME,
        fn: "get-dy",
        pool: POOL_SBTC_STX,
        xToken: SBTC,
        yToken: WSTX,
      },
    ],
    exec: {
      kind: "direct",
      contract: XYK_CORE,
      fn: "swap-x-for-y",
      pool: POOL_SBTC_STX,
      xToken: SBTC,
      yToken: WSTX,
    },
  },
  {
    from: "sbtc",
    to: "usdcx",
    method: "router",
    hops: ["sBTC", "STX", "aeUSDC", "USDCx"],
    quote: [
      {
        coreAddress: XYK_CORE_ADDRESS,
        coreName: XYK_CORE_NAME,
        fn: "get-dy",
        pool: POOL_SBTC_STX,
        xToken: SBTC,
        yToken: WSTX,
      },
      {
        coreAddress: XYK_CORE_ADDRESS,
        coreName: XYK_CORE_NAME,
        fn: "get-dy",
        pool: POOL_STX_AEUSDC,
        xToken: WSTX,
        yToken: AEUSDC,
      },
      {
        coreAddress: SS_CORE_ADDRESS,
        coreName: SS_CORE_NAME,
        fn: "get-dy",
        pool: POOL_AEUSDC_USDCX,
        xToken: AEUSDC,
        yToken: USDCX,
      },
    ],
    exec: {
      kind: "router",
      contract: ROUTER_SBTC_USDCX,
      fn: "swap-sbtc-for-token",
    },
  },
];

/** Display/resolver view of the table — the only place routes are listed. */
const ROUTES: SwapRoute[] = ROUTE_TABLE.map(({ from, to, method, hops }) => ({
  from,
  to,
  method,
  hops,
}));

export function getRoute(fromId: string, toId: string): SwapRoute | null {
  return ROUTES.find((r) => r.from === fromId && r.to === toId) ?? null;
}

export function getValidDestinations(fromId: string): SwapToken[] {
  const validIds = ROUTES.filter((r) => r.from === fromId).map((r) => r.to);
  return SWAP_TOKENS.filter((t) => validIds.includes(t.id));
}

export function getSwappableFromTokens(): SwapToken[] {
  const fromIds = [...new Set(ROUTES.map((r) => r.from))];
  return SWAP_TOKENS.filter((t) => fromIds.includes(t.id));
}
