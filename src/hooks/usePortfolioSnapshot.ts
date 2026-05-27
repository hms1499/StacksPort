"use client";

import useSWR from "swr";
import type {
  PortfolioSnapshot,
  FungibleTokens,
  TransactionsPage,
  TokensWithValues,
} from "@/lib/server/portfolio-snapshot";
import type {
  PortfolioValue,
  PnLData,
  StackingStatus,
  SBTCData,
} from "@/lib/stacks";
import type { DCAPlan } from "@/lib/dca";

const REFRESH_MS = 30_000;

async function fetchSnapshot(address: string): Promise<PortfolioSnapshot> {
  const res = await fetch(
    `/api/portfolio/snapshot?address=${encodeURIComponent(address)}`
  );
  if (!res.ok) throw new Error("portfolio snapshot fetch failed");
  return res.json();
}

export function usePortfolioSnapshot(address: string | undefined) {
  return useSWR<PortfolioSnapshot>(
    address ? ["portfolio-snapshot", address] : null,
    () => fetchSnapshot(address!),
    {
      refreshInterval: REFRESH_MS,
      dedupingInterval: 15_000,
      revalidateOnFocus: false,
    }
  );
}

function selector<T>(pick: (s: PortfolioSnapshot) => T | null | undefined) {
  return (address: string | undefined) => {
    const { data, isLoading, error, mutate } = usePortfolioSnapshot(address);
    return {
      data: data ? (pick(data) ?? undefined) : undefined,
      isLoading,
      error,
      mutate,
    };
  };
}

export const usePortfolioSnap = selector<PortfolioValue>((s) => s.portfolio);
export const useFungibleTokensSnap = selector<FungibleTokens>(
  (s) => s.fungibleTokens
);
export const useTokensWithValuesSnap = selector<TokensWithValues>(
  (s) => s.tokensWithValues
);
export const useUserDCAPlansSnap = selector<DCAPlan[]>((s) => s.dcaPlans);
export const usePnLDataSnap = selector<PnLData>((s) => s.pnl);
export const useStackingStatusSnap = selector<StackingStatus>(
  (s) => s.stackingStatus
);
export const useSBTCDataSnap = selector<SBTCData>((s) => s.sbtcData);

// Transactions: snapshot caches top 20; consumers slice to their own limit.
export function useTransactionsSnap(
  address: string | undefined,
  limit = 8
): {
  data: TransactionsPage | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = usePortfolioSnapshot(address);
  if (!data?.transactions) {
    return { data: undefined, isLoading, error };
  }
  const tx = data.transactions;
  // Hiro's shape: { results: [...], total, limit, offset }
  if (Array.isArray(tx?.results)) {
    return {
      data: { ...tx, results: tx.results.slice(0, limit) },
      isLoading,
      error,
    };
  }
  return { data: tx, isLoading, error };
}

export type { PortfolioSnapshot };
