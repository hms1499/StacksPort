// src/lib/domain/swap/contracts.ts
// Pure on-chain contract references. No I/O. Shared by tokens.ts (display
// registry) and routes.ts (on-chain quote/exec wiring).

export type TokenRef = { address: string; name: string };

// XYK Core
export const XYK_CORE_ADDRESS = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
export const XYK_CORE_NAME = "xyk-core-v-1-2";
export const XYK_CORE: TokenRef = { address: XYK_CORE_ADDRESS, name: XYK_CORE_NAME };

// Stableswap Core
export const SS_CORE_ADDRESS = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
export const SS_CORE_NAME = "stableswap-core-v-1-4";

// Pools
export const POOL_SBTC_STX: TokenRef = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "xyk-pool-sbtc-stx-v-1-1" };
export const POOL_STX_AEUSDC: TokenRef = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "xyk-pool-stx-aeusdc-v-1-2" };
export const POOL_AEUSDC_USDCX: TokenRef = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "stableswap-pool-aeusdc-usdcx-v-1-1" };

// Routers
export const ROUTER_STX_SBTC: TokenRef = { address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV", name: "bitflow-sbtc-swap-router" };
export const ROUTER_SBTC_USDCX: TokenRef = { address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV", name: "bitflow-usdcx-swap-router" };
export const ROUTER_STACKSPORT: TokenRef = { address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV", name: "stacksport-swap-router" };

// Tokens
export const SBTC: TokenRef = { address: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", name: "sbtc-token" };
export const WSTX: TokenRef = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "token-stx-v-1-2" };
export const AEUSDC: TokenRef = { address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", name: "token-aeusdc" };
export const USDCX: TokenRef = { address: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE", name: "usdcx" };
