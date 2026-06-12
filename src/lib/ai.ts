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

// An alert may carry an optional call-to-action that deep-links to where the
// user would act on it. The destination set is a fixed enum — neither the LLM
// (global feed) nor any signal (personalized feed) ever supplies a raw URL, so
// a CTA can only ever point at a route we control. `href` is resolved from the
// kind via ALERT_ACTION_HREF; locale prefixing is handled by next-intl <Link>.
export type AlertActionKind = "dca-open" | "trade-swap" | "view-assets";

export const ALERT_ACTION_KINDS: readonly AlertActionKind[] = [
  "dca-open",
  "trade-swap",
  "view-assets",
];

export const ALERT_ACTION_HREF: Record<AlertActionKind, string> = {
  "dca-open": "/dca",
  "trade-swap": "/trade?from=STX&to=sBTC",
  "view-assets": "/assets",
};

// Canonical actionable-alert shape. Shared by the global insights feed
// (AlertItem) and the personalized portfolio alerts (PersonalAlert, re-aliased
// in ai-portfolio.ts) so the shape — and any future type/priority value — is
// defined in exactly one place.
export interface Alert {
  title: string;
  description: string;
  type: "opportunity" | "warning" | "info";
  priority: "high" | "medium" | "low";
  // Optional deep-link CTA. Absent for purely informational alerts.
  action?: AlertActionKind;
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
