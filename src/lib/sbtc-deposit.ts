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
