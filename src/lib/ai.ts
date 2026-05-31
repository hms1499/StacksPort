// ─── AI Market Intelligence Types ────────────────────────────────────────────

export interface SentimentData {
  summary: string;
  score: number;          // -100 (bearish) to 100 (bullish)
  fearGreedValue: number;
  signals: { label: string; type: "bullish" | "bearish" | "neutral" }[];
}

export interface KOLSignalCoin {
  symbol: string;
  name: string;
  galaxyScore: number;          // 0–100, LunarCrush Galaxy Score
  socialVolume: number;         // 24h social post volume
  sentiment: "bullish" | "bearish" | "neutral";
  insight: string;              // 1-sentence Groq analysis
}

export interface KOLSignalsData {
  summary: string;              // 2-3 sentence overview from Groq
  coins: KOLSignalCoin[];
}

// Canonical actionable-alert shape. Shared by the global insights feed
// (AlertItem) and the personalized portfolio alerts (PersonalAlert, re-aliased
// in ai-portfolio.ts) so the shape — and any future type/priority value — is
// defined in exactly one place.
export interface Alert {
  title: string;
  description: string;
  type: "opportunity" | "warning" | "info";
  priority: "high" | "medium" | "low";
}

export type AlertItem = Alert;

export interface NewsDigestItem {
  headline: string;
  insight: string;
  source: string;
  url: string;
  imageUrl?: string;
}

export interface AIInsightsResponse {
  generatedAt: string;
  sentiment: SentimentData;
  kolSignals: KOLSignalsData;
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
