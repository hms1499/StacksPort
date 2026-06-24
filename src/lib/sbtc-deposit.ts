// src/lib/sbtc-deposit.ts
import {
  SbtcApiClientMainnet,
  SbtcApiClientTestnet,
  SbtcApiClient,
  buildSbtcDepositAddress,
  MAINNET,
  TESTNET,
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

// Normalise a public key to 32-byte schnorr format (64 hex chars).
// If a 33-byte compressed ECDSA key (66 hex chars) is passed, the leading
// parity prefix byte (02/03) is stripped to yield the 32-byte x-coordinate.
function toSchnorrHex(hex: string): string {
  return hex.length === 66 ? hex.slice(2) : hex;
}

export interface DepositInput {
  stacksAddress: string;
  reclaimPublicKey: string;
  maxSignerFee?: number;
  reclaimLockTime?: number;
  client?: { fetchSignersPublicKey(): Promise<string> };
  network?: SbtcNetwork;
}

export interface DepositParams {
  address: string;
  depositScript: string;
  reclaimScript: string;
}

export async function buildDepositParams(input: DepositInput): Promise<DepositParams> {
  const network = input.network ?? getSbtcNetwork();
  const client = input.client ?? makeSbtcClient(network);
  const rawSignersKey = await client.fetchSignersPublicKey();
  const deposit = buildSbtcDepositAddress({
    stacksAddress: input.stacksAddress,
    signersPublicKey: toSchnorrHex(rawSignersKey),
    reclaimPublicKey: toSchnorrHex(input.reclaimPublicKey),
    reclaimLockTime: input.reclaimLockTime ?? 950,
    maxSignerFee: input.maxSignerFee ?? DEFAULT_MAX_SIGNER_FEE_SATS,
    network: network === "testnet" ? TESTNET : MAINNET,
  });
  return {
    address: deposit.address,
    depositScript: deposit.depositScript,
    reclaimScript: deposit.reclaimScript,
  };
}
