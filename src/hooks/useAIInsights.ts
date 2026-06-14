"use client";

import useSWR from "swr";
import { useLocale } from "next-intl";
import { fetchAIInsights, type AIInsightsResponse } from "@/lib/ai";

const AI_REFRESH = 300_000;   // 5 min
const AI_DEDUP   = 120_000;   // 2 min

export function useAIInsights() {
  const locale = useLocale();
  // Locale is part of the key so switching language refetches (and caches)
  // separately instead of showing the previous language's insights.
  return useSWR<AIInsightsResponse>(
    ["ai-insights", locale],
    () => fetchAIInsights(locale),
    { refreshInterval: AI_REFRESH, dedupingInterval: AI_DEDUP }
  );
}
