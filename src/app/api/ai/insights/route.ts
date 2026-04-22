import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { AIInsightsResponse } from "@/lib/ai";

// ─── Cache ───────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cached: { data: AIInsightsResponse; timestamp: number } | null = null;

// ─── Rate Limit ──────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX) return true;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

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
  priceHistory30d: number[];
}

interface FearGreed {
  value: number;
  classification: string;
}

interface NewsItem {
  title: string;
  source: string;
  url: string;
}

async function fetchMarketData(): Promise<MarketData> {
  const [statsRes, btcRes, hist7dRes, hist30dRes] = await Promise.allSettled([
    fetch(
      `${COINGECKO}/coins/blockstack?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
      { signal: AbortSignal.timeout(10_000) }
    ),
    fetch(
      `${COINGECKO}/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(10_000) }
    ),
    fetch(
      `${COINGECKO}/coins/blockstack/market_chart?vs_currency=usd&days=7&interval=daily`,
      { signal: AbortSignal.timeout(10_000) }
    ),
    fetch(
      `${COINGECKO}/coins/blockstack/market_chart?vs_currency=usd&days=30&interval=daily`,
      { signal: AbortSignal.timeout(10_000) }
    ),
  ]);

  let stxPrice = 0, stxChange24h = 0, stxMarketCap = 0, stxVolume24h = 0;
  if (statsRes.status === "fulfilled" && statsRes.value.ok) {
    const d = await statsRes.value.json();
    stxPrice = d.market_data?.current_price?.usd ?? 0;
    stxChange24h = d.market_data?.price_change_percentage_24h ?? 0;
    stxMarketCap = d.market_data?.market_cap?.usd ?? 0;
    stxVolume24h = d.market_data?.total_volume?.usd ?? 0;
  }

  let btcPrice = 0, btcChange24h = 0;
  if (btcRes.status === "fulfilled" && btcRes.value.ok) {
    const d = await btcRes.value.json();
    btcPrice = d.bitcoin?.usd ?? 0;
    btcChange24h = d.bitcoin?.usd_24h_change ?? 0;
  }

  let priceHistory7d: number[] = [];
  if (hist7dRes.status === "fulfilled" && hist7dRes.value.ok) {
    const d = await hist7dRes.value.json();
    priceHistory7d = (d.prices as [number, number][]).map(([, v]) => v);
  }

  let priceHistory30d: number[] = [];
  if (hist30dRes.status === "fulfilled" && hist30dRes.value.ok) {
    const d = await hist30dRes.value.json();
    priceHistory30d = (d.prices as [number, number][]).map(([, v]) => v);
  }

  return { stxPrice, stxChange24h, stxMarketCap, stxVolume24h, btcPrice, btcChange24h, priceHistory7d, priceHistory30d };
}

async function fetchFearGreed(): Promise<FearGreed> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json();
    const d = json.data?.[0];
    return { value: Number(d?.value ?? 50), classification: d?.value_classification ?? "Neutral" };
  } catch {
    return { value: 50, classification: "Neutral" };
  }
}

async function fetchNews(): Promise<NewsItem[]> {
  const feeds = [
    { url: "https://cointelegraph.com/rss", source: "CoinTelegraph" },
    { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk" },
  ];

  const results = await Promise.allSettled(
    feeds.map((f) =>
      fetch(f.url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10_000),
      })
        .then((r) => r.text())
        .then((text) => {
          const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
          return items.slice(0, 6).map((m) => {
            const title = m[1].match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? "";
            const link = m[1].match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim() ?? "";
            return { title, url: link, source: f.source };
          }).filter((item) => item.title);
        })
    )
  );

  const items: NewsItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }
  return items.slice(0, 10);
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

  const price30dChange = market.priceHistory30d.length >= 2
    ? ((market.priceHistory30d[market.priceHistory30d.length - 1] - market.priceHistory30d[0]) / market.priceHistory30d[0] * 100).toFixed(2)
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
- STX 30d Change: ${price30dChange}%
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
      {"title": "short title", "description": "actionable insight", "type": "<opportunity|warning|info>", "priority": "<high|medium|low>"}
    ]
  },
  "newsDigest": {
    "summary": "2-3 sentence overview of the most important news",
    "items": [${news.slice(0, 5).map(n => `{"headline": "${n.title.replace(/"/g, '\\"')}", "insight": "1 sentence relevance to Stacks/STX", "source": "${n.source}", "url": "${n.url}"}`).join(", ")}]
  }
}

Important:
- Focus on Stacks (STX) ecosystem and Bitcoin (sBTC) relevance
- Provide 3-5 signals in sentiment
- Provide 2-4 actionable alerts
- Keep insights concise and actionable
- For news items, update the "insight" field with your analysis of relevance to Stacks
- For kolSignals, include all coins from the LunarCrush data provided; if no LunarCrush data, return empty coins array
- Return ONLY valid JSON, no markdown fences`;
}

async function generateInsights(
  market: MarketData,
  fearGreed: FearGreed,
  news: NewsItem[],
  lunarcrushCoins: LunarCrushCoin[]
): Promise<AIInsightsResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "You are a crypto market analyst. Respond with valid JSON only, no markdown fences.",
      },
      {
        role: "user",
        content: buildPrompt(market, fearGreed, news, lunarcrushCoins),
      },
    ],
    temperature: 0.3,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);

  return {
    generatedAt: new Date().toISOString(),
    sentiment: parsed.sentiment,
    kolSignals: parsed.kolSignals ?? { summary: "", coins: [] },
    alerts: parsed.alerts,
    newsDigest: parsed.newsDigest,
  };
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  // Return cache if fresh
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  try {
    const [market, fearGreed, news, lunarcrushCoins] = await Promise.all([
      fetchMarketData(),
      fetchFearGreed(),
      fetchNews(),
      fetchLunarCrushSignals(),
    ]);

    const insights = await generateInsights(market, fearGreed, news, lunarcrushCoins);

    cached = { data: insights, timestamp: Date.now() };

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
