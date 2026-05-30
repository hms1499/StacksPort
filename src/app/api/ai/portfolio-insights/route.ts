// src/app/api/ai/portfolio-insights/route.ts
import { NextResponse } from "next/server";
import { getPortfolioSnapshot, isValidStacksAddress } from "@/lib/server/portfolio-snapshot";
import { getMarketSnapshot } from "@/lib/server/market-snapshot";
import { detectSignals } from "@/lib/server/portfolio-signals";
import { generatePersonalAlerts } from "@/lib/server/personal-alerts";
import {
  getCachedPortfolioInsights,
  setCachedPortfolioInsights,
  isPortfolioRateLimited,
} from "@/lib/server/ai-insights-cache";
import type { PortfolioInsightsResponse } from "@/lib/ai-portfolio";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim() ?? "";
  if (!isValidStacksAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  if (await isPortfolioRateLimited(address)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const cached = await getCachedPortfolioInsights(address);
  if (cached) return NextResponse.json(cached);

  try {
    const [portfolio, market] = await Promise.all([
      getPortfolioSnapshot(address),
      getMarketSnapshot(),
    ]);

    const signals = detectSignals({
      dcaPlans: portfolio.dcaPlans,
      pnl: portfolio.pnl,
      sbtcData: portfolio.sbtcData,
      fearGreed: market.fearGreed,
    });

    const alerts = await generatePersonalAlerts(signals, {
      fearGreed: market.fearGreed,
      stxChange24h: market.stxStats?.change24h ?? null,
    });

    const response: PortfolioInsightsResponse = {
      generatedAt: new Date().toISOString(),
      alerts,
    };
    await setCachedPortfolioInsights(address, response);
    return NextResponse.json(response);
  } catch (err) {
    console.error("[Portfolio Insights] Error:", err);
    return NextResponse.json({ error: "Failed to generate portfolio insights" }, { status: 500 });
  }
}
