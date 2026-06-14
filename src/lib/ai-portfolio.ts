// src/lib/ai-portfolio.ts
// Client-safe types + fetcher for the personalized "Your Position" alerts.
// Mirrors src/lib/ai.ts (the global insights equivalent).
import type { Alert } from "@/lib/ai";

// Personalized alerts share the canonical Alert shape with the global feed.
export type PersonalAlert = Alert;

export interface PortfolioInsightsResponse {
  generatedAt: string;
  alerts: PersonalAlert[]; // [] when there are no signals
}

export async function fetchPortfolioInsights(
  address: string,
  locale: string
): Promise<PortfolioInsightsResponse> {
  const res = await fetch(
    `/api/ai/portfolio-insights?address=${encodeURIComponent(address)}&locale=${encodeURIComponent(locale)}`
  );
  if (!res.ok) throw new Error("Failed to fetch portfolio insights");
  return res.json();
}
