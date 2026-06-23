// Verified Zest (Aave-style) mainnet principals for the sBTC reserve.
// Source: Hiro contract interface + real on-chain supply tx +
// pool-0-reserve.get-reserve-state(sbtc-token), checked 2026-06-23.
// DO NOT guess or edit without re-verifying on-chain.

export interface ContractId {
  address: string;
  name: string;
}

export const ZEST_BORROW_HELPER: ContractId = {
  address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N",
  name: "borrow-helper-v2-0",
};

export const ZEST_POOL_RESERVE: ContractId = {
  address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N",
  name: "pool-0-reserve",
};

export const ZEST_ORACLE_SBTC: ContractId = {
  address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N",
  name: "stx-btc-oracle-v1-4",
};

export const SBTC_ASSET: ContractId = {
  address: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4",
  name: "sbtc-token",
};

export const ZSBTC_ATOKEN: ContractId = {
  address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N",
  name: "zsbtc-v2-0",
};

/** SIP-010 fungible-token asset name inside the sbtc-token contract. */
export const SBTC_FT_ASSET_NAME = "sbtc-token";

/** sBTC has 8 decimals (sats). */
export const SBTC_DECIMALS = 8;
