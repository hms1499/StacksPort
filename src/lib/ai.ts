// ─── AI Market Intelligence Types ────────────────────────────────────────────

export interface SentimentData {
  summary: string;
  score: number;          // -100 (bearish) to 100 (bullish)
  fearGreedValue: number;
  signals: { label: string; type: "bullish" | "bearish" | "neutral" }[];
}

export interface TrendData {
  summary: string;
  tokens: {
    symbol: string;
    direction: "up" | "down" | "sideways";
    insight: string;
    changePercent: number;
  }[];
}

export interface AlertItem {
  title: string;
  description: string;
  type: "opportunity" | "warning" | "info";
  priority: "high" | "medium" | "low";
}

export interface NewsDigestItem {
  headline: string;
  insight: string;
  source: string;
  url: string;
}

export interface AIInsightsResponse {
  generatedAt: string;
  sentiment: SentimentData;
  trends: TrendData;
  alerts: { items: AlertItem[] };
  newsDigest: {
    summary: string;
    items: NewsDigestItem[];
  };
}

export async function fetchAIInsights(): Promise<AIInsightsResponse> {
  const res = await fetch("/api/ai/insights");
  if (!res.ok) throw new Error("Failed to fetch AI insights");
  return res.json();
}
