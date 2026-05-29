"use client";

import useSWR from "swr";
import { useWalletStore } from "@/store/walletStore";
import { CONTRACT_TO_GECKO_ID, GECKO_ID_TO_DECIMALS } from "@/lib/token-registry";

const HIRO_API = "https://api.hiro.so";

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
    const coingeckoId = CONTRACT_TO_GECKO_ID[contractId];
    if (!coingeckoId) continue;
    const raw = Number(val.balance ?? 0);
    if (raw <= 0) continue;
    const decimals = GECKO_ID_TO_DECIMALS[coingeckoId] ?? 6;
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
