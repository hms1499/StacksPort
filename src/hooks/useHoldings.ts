"use client";

import useSWR from "swr";
import { useWalletStore } from "@/store/walletStore";

const HIRO_API = "https://api.hiro.so";

// Maps Stacks contract id (lowercase, principal.name) → CoinGecko coin id.
// Extend as we add more Stacks tokens with reliable price feeds.
const CONTRACT_TO_COINGECKO: Record<string, string> = {
  "sm3vdxk3wzzsa84xxfkafaf15nnzx32ctsg82jfq4.sbtc-token": "sbtc-2",
};

const STX_DECIMALS = 6;

export interface Holding {
  amount: number;
}

interface HiroBalances {
  stx: { balance: string };
  fungible_tokens: Record<string, { balance: string }>;
}

async function fetchHoldings(address: string): Promise<Record<string, Holding>> {
  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
  if (!res.ok) throw new Error("Failed to fetch balances");
  const data = (await res.json()) as HiroBalances;

  const out: Record<string, Holding> = {};

  const stxRaw = Number(data.stx?.balance ?? 0);
  if (stxRaw > 0) {
    out["blockstack"] = { amount: stxRaw / 10 ** STX_DECIMALS };
  }

  const fts = data.fungible_tokens ?? {};
  for (const [key, val] of Object.entries(fts)) {
    // key shape: "SP....contract::asset"
    const contractId = key.split("::")[0]?.toLowerCase();
    if (!contractId) continue;
    const coingeckoId = CONTRACT_TO_COINGECKO[contractId];
    if (!coingeckoId) continue;
    const raw = Number(val.balance ?? 0);
    if (raw <= 0) continue;
    // sBTC uses 8 decimals. Future tokens may differ — keep table next to mapping.
    const decimals = coingeckoId === "sbtc-2" ? 8 : 6;
    out[coingeckoId] = { amount: raw / 10 ** decimals };
  }

  return out;
}

export function useHoldings() {
  const stxAddress = useWalletStore((s) => s.stxAddress);
  const { data, error, isLoading } = useSWR<Record<string, Holding>>(
    stxAddress ? ["holdings", stxAddress] : null,
    () => fetchHoldings(stxAddress!),
    { refreshInterval: 60_000, dedupingInterval: 30_000 }
  );
  return {
    holdings: data ?? {},
    isLoading,
    error,
    isConnected: !!stxAddress,
  };
}
