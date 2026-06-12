import { NextResponse } from "next/server";
import type { AIInsightsResponse } from "@/lib/ai";
import {
  getCachedInsights,
  setCachedInsights,
  isRateLimited,
} from "@/lib/server/ai-insights-cache";
import { parseInsights } from "@/lib/server/ai-insights-schema";
import { completeJSON } from "@/lib/server/groq-client";
import { getMarketSnapshot, type MarketSnapshot } from "@/lib/server/market-snapshot";

// ─── Data Fetchers ───────────────────────────────────────────────────────────
const COINGECKO = "https://api.coingecko.com/api/v3";

interface MarketData {
  stxPrice: number;
  stxChange24h: number;
  stxMarketCap: number;
  stxVolume24h: number;
  btcPrice: number;
  btcChange24h: number;
  priceHistory7d: number[];
}

interface FearGreed {
  value: number;
  classification: string;
}

interface NewsItem {
  title: string;
  source: string;
  url: string;
  imageUrl?: string;
}

interface Btc {
  price: number;
  change24h: number;
}

// BTC price isn't in the market snapshot, so fetch it standalone. It's a cheap
// simple/price call (one CoinGecko endpoint vs the four this route used to make
// — the STX stats / 7d history / fear&greed / news now come from the shared,
// 60s-cached market snapshot instead of being re-fetched here).
async function fetchBtc(): Promise<Btc> {
  try {
    const res = await fetch(
      `${COINGECKO}/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return { price: 0, change24h: 0 };
    const d = await res.json();
    return { price: d.bitcoin?.usd ?? 0, change24h: d.bitcoin?.usd_24h_change ?? 0 };
  } catch {
    return { price: 0, change24h: 0 };
  }
}

function toMarketData(snapshot: MarketSnapshot, btc: Btc): MarketData {
  const stats = snapshot.stxStats;
  return {
    stxPrice: stats?.price ?? 0,
    stxChange24h: stats?.change24h ?? 0,
    stxMarketCap: stats?.marketCap ?? 0,
    stxVolume24h: stats?.volume24h ?? 0,
    btcPrice: btc.price,
    btcChange24h: btc.change24h,
    priceHistory7d: snapshot.stxHistory7d?.prices ?? [],
  };
}

function toNewsItems(snapshot: MarketSnapshot): NewsItem[] {
  return (snapshot.news ?? []).slice(0, 10).map((n) => ({
    title: n.title,
    source: n.source,
    url: n.url,
    imageUrl: n.imageUrl,
  }));
}

// ─── LunarCrush ──────────────────────────────────────────────────────────────

interface LunarCrushCoin {
  symbol: string;
  name: string;
  galaxy_score: number;
  social_volume_24h: number;
  price_change_24h: number;
}

async function fetchLunarCrushSignals(): Promise<LunarCrushCoin[]> {
  const apiKey = process.env.LUNARCRUSH_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(
      "https://lunarcrush.com/api4/public/coins/list/v2?sort=social_score&limit=10",
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? []).map((c: Record<string, unknown>) => ({
      symbol: String(c.symbol ?? ""),
      name: String(c.name ?? ""),
      galaxy_score: Number(c.galaxy_score ?? 0),
      social_volume_24h: Number(c.social_volume_24h ?? 0),
      price_change_24h: Number(c.price_change_24h ?? 0),
    }));
  } catch {
    return [];
  }
}

// ─── Groq AI ─────────────────────────────────────────────────────────────────

function buildPrompt(market: MarketData, fearGreed: FearGreed, news: NewsItem[], lunarcrushCoins: LunarCrushCoin[]): string {
  const newsText = news.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join("\n");

  const price7dChange = market.priceHistory7d.length >= 2
    ? ((market.priceHistory7d[market.priceHistory7d.length - 1] - market.priceHistory7d[0]) / market.priceHistory7d[0] * 100).toFixed(2)
    : "N/A";

  const lunarSection = lunarcrushCoins.length > 0
    ? `\n## Top Social Signals (LunarCrush)\n${lunarcrushCoins
        .map((c, i) =>
          `${i + 1}. ${c.symbol} (${c.name}) — Galaxy Score: ${c.galaxy_score}, Social Volume 24h: ${c.social_volume_24h.toLocaleString()}, Price 24h: ${c.price_change_24h >= 0 ? "+" : ""}${c.price_change_24h.toFixed(2)}%`
        )
        .join("\n")}`
    : "";

  return `Analyze the following Stacks (STX) and crypto market data and provide insights.

## Market Data
- STX Price: $${market.stxPrice.toFixed(4)}
- STX 24h Change: ${market.stxChange24h.toFixed(2)}%
- STX 7d Change: ${price7dChange}%
- STX Market Cap: $${(market.stxMarketCap / 1e6).toFixed(1)}M
- STX 24h Volume: $${(market.stxVolume24h / 1e6).toFixed(1)}M
- BTC Price: $${market.btcPrice.toFixed(0)}
- BTC 24h Change: ${market.btcChange24h.toFixed(2)}%
- STX 7d Price Points: [${market.priceHistory7d.map(p => p.toFixed(4)).join(", ")}]

## Fear & Greed Index
- Value: ${fearGreed.value}/100
- Classification: ${fearGreed.classification}
${lunarSection}
## Latest Crypto News
${newsText}

Respond with a JSON object matching this exact structure (no markdown, just raw JSON):
{
  "sentiment": {
    "summary": "2-3 sentence market sentiment analysis focusing on STX and Stacks ecosystem",
    "score": <number from -100 to 100, bearish to bullish>,
    "fearGreedValue": ${fearGreed.value},
    "signals": [{"label": "<signal name>", "type": "<bullish|bearish|neutral>"}]
  },
  "kolSignals": {
    "summary": "2-3 sentence overview of which coins are gaining social momentum and why",
    "coins": [
      {"symbol": "STX", "name": "Stacks", "galaxyScore": 72, "socialVolume": 12400, "sentiment": "<bullish|bearish|neutral>", "insight": "1 sentence on social relevance"}
    ]
  },
  "alerts": {
    "items": [
      {"title": "short title", "description": "actionable insight", "type": "<opportunity|warning|info>", "priority": "<high|medium|low>", "action": "<dca-open|trade-swap|view-assets, or omit>"}
    ]
  },
  "newsDigest": {
    "summary": "2-3 sentence overview of the most important news",
    "insights": ["1 sentence on item 1's relevance to Stacks/STX", "... item 2", "... up to item ${Math.min(news.length, 5)}"]
  }
}

Important:
- Focus on Stacks (STX) ecosystem and Bitcoin (sBTC) relevance
- Provide 3-5 signals in sentiment
- Provide 2-4 actionable alerts
- Optionally add "action" to an alert when there's a clear next step the user can take in this app: "trade-swap" for a buy/swap opportunity (STX→sBTC), "dca-open" to set up recurring buys, "view-assets" to review holdings. OMIT "action" entirely for purely informational alerts.
- Keep insights concise and actionable
- newsDigest.insights must be an array of plain strings, one per news item above in the SAME ORDER, for the first ${Math.min(news.length, 5)} items. Do NOT repeat the headline or URL — only the relevance sentence.
- For kolSignals, include all coins from the LunarCrush data provided; if no LunarCrush data, return empty coins array
- Return ONLY valid JSON, no markdown fences`;
}

async function generateInsights(
  market: MarketData,
  fearGreed: FearGreed,
  news: NewsItem[],
  lunarcrushCoins: LunarCrushCoin[]
): Promise<AIInsightsResponse> {
  const parsed = parseInsights(
    await completeJSON({
      system: "You are a crypto market analyst. Respond with valid JSON only, no markdown fences.",
      prompt: buildPrompt(market, fearGreed, news, lunarcrushCoins),
      maxTokens: 2048,
      label: "AI Insights",
    })
  );

  // Assemble the news digest from our own factual data (headline/url/source/
  // image) zipped with the model's per-item insight by index — the LLM never
  // supplies the links, so it can't alter or hallucinate them.
  const newsItems = news.slice(0, 5).map((n, i) => ({
    headline: n.title,
    insight: parsed.newsDigest.insights[i] ?? "",
    source: n.source,
    url: n.url,
    imageUrl: n.imageUrl,
  }));

  return {
    generatedAt: new Date().toISOString(),
    sentiment: parsed.sentiment,
    kolSignals: parsed.kolSignals,
    alerts: parsed.alerts,
    newsDigest: { summary: parsed.newsDigest.summary, items: newsItems },
  };
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  // Redis is the single shared cache (source of truth across all instances).
  const fresh = await getCachedInsights();
  if (fresh) {
    return NextResponse.json(fresh, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  try {
    const [snapshot, btc, lunarcrushCoins] = await Promise.all([
      getMarketSnapshot(),
      fetchBtc(),
      fetchLunarCrushSignals(),
    ]);

    const market = toMarketData(snapshot, btc);
    const fearGreed = snapshot.fearGreed ?? { value: 50, classification: "Neutral" };
    const news = toNewsItems(snapshot);

    const insights = await generateInsights(market, fearGreed, news, lunarcrushCoins);

    await setCachedInsights(insights);

    return NextResponse.json(insights, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    console.error("[AI Insights] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
