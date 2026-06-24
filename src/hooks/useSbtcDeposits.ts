"use client";

import useSWR from "swr";
import type { PendingDeposit } from "@/lib/server/sbtc-pending";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSbtcDeposits(address?: string) {
  const { data, isLoading } = useSWR<{ deposits: PendingDeposit[] }>(
    address ? `/api/sbtc/deposits?address=${address}` : null,
    fetcher,
    { refreshInterval: 30_000 },
  );
  return { deposits: data?.deposits ?? [], isLoading };
}
