"use client";

import useSWR from "swr";
import { fetchAIInsights, type AIInsightsResponse } from "@/lib/ai";

const AI_REFRESH = 300_000;   // 5 min
const AI_DEDUP   = 120_000;   // 2 min

export function useAIInsights() {
  return useSWR<AIInsightsResponse>(
    "ai-insights",
    fetchAIInsights,
    { refreshInterval: AI_REFRESH, dedupingInterval: AI_DEDUP }
  );
}
