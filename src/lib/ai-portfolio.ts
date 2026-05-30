// src/lib/ai-portfolio.ts
// Client-safe types + fetcher for the personalized "Your Position" alerts.
// Mirrors src/lib/ai.ts (the global insights equivalent).

export interface PersonalAlert {
  title: string;
  description: string;
  type: "opportunity" | "warning" | "info";
  priority: "high" | "medium" | "low";
}

export interface PortfolioInsightsResponse {
  generatedAt: string;
  alerts: PersonalAlert[]; // [] when there are no signals
}

export async function fetchPortfolioInsights(
  address: string
): Promise<PortfolioInsightsResponse> {
  const res = await fetch(
    `/api/ai/portfolio-insights?address=${encodeURIComponent(address)}`
  );
  if (!res.ok) throw new Error("Failed to fetch portfolio insights");
  return res.json();
}
