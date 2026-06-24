// src/lib/sbtc-deposit.ts
import {
  SbtcApiClientMainnet,
  SbtcApiClientTestnet,
  SbtcApiClient,
} from "sbtc";

export type SbtcNetwork = "mainnet" | "testnet";

export function getSbtcNetwork(): SbtcNetwork {
  return process.env.SBTC_NETWORK === "testnet" ? "testnet" : "mainnet";
}

export function makeSbtcClient(network: SbtcNetwork = getSbtcNetwork()): SbtcApiClient {
  return network === "testnet"
    ? new SbtcApiClientTestnet()
    : new SbtcApiClientMainnet();
}

export const SBTC_DUST_SATS = 10_000;
export const DEFAULT_MAX_SIGNER_FEE_SATS = 80_000;

export interface AmountCheck {
  ok: boolean;
  reason?: "below_min" | "non_integer" | "not_positive";
  minSats: number;
}

export function validateDepositAmount(
  amountSats: number,
  maxSignerFee: number = DEFAULT_MAX_SIGNER_FEE_SATS,
): AmountCheck {
  const minSats = SBTC_DUST_SATS + maxSignerFee;
  if (amountSats <= 0) return { ok: false, reason: "not_positive", minSats };
  if (!Number.isInteger(amountSats)) return { ok: false, reason: "non_integer", minSats };
  if (amountSats < minSats) return { ok: false, reason: "below_min", minSats };
  return { ok: true, minSats };
}
