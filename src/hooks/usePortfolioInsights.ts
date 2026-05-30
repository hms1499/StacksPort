// src/hooks/usePortfolioInsights.ts
"use client";

import useSWR from "swr";
import { fetchPortfolioInsights, type PortfolioInsightsResponse } from "@/lib/ai-portfolio";

const REFRESH_MS = 12 * 60_000; // matches the 12-min server cache TTL
const DEDUP_MS = 60_000;

export function usePortfolioInsights(address: string | undefined) {
  return useSWR<PortfolioInsightsResponse>(
    address ? ["portfolio-insights", address] : null,
    () => fetchPortfolioInsights(address!),
    { refreshInterval: REFRESH_MS, dedupingInterval: DEDUP_MS, revalidateOnFocus: false }
  );
}
