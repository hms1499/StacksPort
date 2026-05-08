"use client";

import useSWR from "swr";
import type { BubbleToken } from "@/app/api/bubbles/route";

export type { BubbleToken };

async function fetchBubbles(): Promise<BubbleToken[]> {
  const res = await fetch("/api/bubbles");
  if (!res.ok) throw new Error("Failed to fetch bubbles");
  return res.json();
}

export function useBubblesData() {
  return useSWR<BubbleToken[]>("bubbles", fetchBubbles, {
    refreshInterval: 60_000,
    dedupingInterval: 30_000,
  });
}
