// src/lib/server/personal-alerts.ts
// Turns deterministic signals into client-facing alerts. templateAlerts() is
// the deterministic fallback (and the source of truth for type/priority
// mapping); generatePersonalAlerts() (Task 5) asks Groq to phrase them and
// falls back here on any failure.
import type { PersonalAlert } from "@/lib/ai-portfolio";
import { parsePersonalAlerts } from "./personal-alerts-schema";
import { completeJSON } from "./groq-client";
import type { PortfolioSignal, SignalKind } from "./portfolio-signals";
import type { FearGreedLite } from "./portfolio-signals";

const TYPE_BY_KIND: Record<SignalKind, PersonalAlert["type"]> = {
  "dca-runway-low": "warning",
  "dca-balance-empty": "warning",
  "dca-dip-buy": "opportunity",
  "pnl-gain": "opportunity",
  "pnl-loss": "warning",
  "sbtc-depeg": "warning",
};

function template(sig: PortfolioSignal): PersonalAlert {
  const f = sig.facts;
  const type = TYPE_BY_KIND[sig.kind];
  const priority = sig.severity;
  switch (sig.kind) {
    case "dca-runway-low":
      return { type, priority, title: `DCA plan #${f.planId} running low`,
        description: `About ${f.daysLeft} days (${f.swapsLeft} swaps) of balance left. Top it up to keep the schedule going.` };
    case "dca-balance-empty":
      return { type, priority, title: `DCA plan #${f.planId} can't fund next swap`,
        description: `Balance ${f.balanceStx} STX is below the ${f.amtPerSwapStx} STX per-swap amount. Add funds to resume.` };
    case "dca-dip-buy":
      return { type, priority, title: `Buying the dip`,
        description: `Fear & Greed is ${f.fearGreedValue} (${f.classification}) and your ${f.planCount} active DCA plan(s) are accumulating into weakness.` };
    case "pnl-gain":
      return { type, priority, title: `${f.symbol} up ${f.unrealizedPct}%`,
        description: `${f.symbol}: unrealized +$${f.unrealizedPnL} on a $${f.currentValue} position. Consider whether to take some profit.` };
    case "pnl-loss":
      // unrealizedPct / unrealizedPnL are negative; show the magnitude so the
      // copy reads "down 45%" / "-$90" instead of "down -45%" / "$-90".
      return { type, priority, title: `${f.symbol} down ${Math.abs(Number(f.unrealizedPct))}%`,
        description: `Unrealized -$${Math.abs(Number(f.unrealizedPnL))}. Review your thesis or DCA level.` };
    case "sbtc-depeg":
      return { type, priority, title: `sBTC off peg`,
        description: `sBTC is ${f.deviationPct}% from BTC (≈$${f.pegPrice}). Be cautious with sBTC swaps right now.` };
  }
}

export function templateAlerts(signals: PortfolioSignal[]): PersonalAlert[] {
  return signals.map(template);
}

export interface MarketContext {
  fearGreed: FearGreedLite | null;
  stxChange24h: number | null;
}

function buildPrompt(signals: PortfolioSignal[], market: MarketContext): string {
  return `You are a crypto portfolio analyst for a Stacks (STX) DCA app. Below are
factual signals detected from the user's own wallet, each with real numbers.

## Signals
${JSON.stringify(signals, null, 2)}

## Market context
- Fear & Greed: ${market.fearGreed ? `${market.fearGreed.value} (${market.fearGreed.classification})` : "N/A"}
- STX 24h change: ${market.stxChange24h != null ? `${market.stxChange24h.toFixed(2)}%` : "N/A"}

Select the 2-4 most important signals and write user-facing alerts. Respond with a
JSON object (no markdown fences):
{
  "alerts": [
    {"title": "short title", "description": "1-2 sentences", "type": "opportunity|warning|info", "priority": "high|medium|low"}
  ]
}

Rules:
- Use ONLY numbers that appear in the signal facts. Never compute or invent figures.
- Keep priority consistent with each signal's severity.
- Be concise and actionable. Return ONLY valid JSON.`;
}

export async function generatePersonalAlerts(
  signals: PortfolioSignal[],
  market: MarketContext
): Promise<PersonalAlert[]> {
  if (signals.length === 0) return [];
  // No API key → skip the (throwing) Groq call and use the deterministic copy.
  if (!process.env.GROQ_API_KEY) return templateAlerts(signals);

  try {
    const { alerts } = parsePersonalAlerts(
      await completeJSON({
        system: "You are a crypto portfolio analyst. Respond with valid JSON only.",
        prompt: buildPrompt(signals, market),
        maxTokens: 1024,
        label: "Portfolio Alerts",
      })
    );
    // If the model returned nothing usable, fall back rather than show an empty section.
    return alerts.length > 0 ? alerts : templateAlerts(signals);
  } catch (err) {
    console.warn("[Portfolio Alerts] generation failed, using template fallback:", err);
    return templateAlerts(signals);
  }
}
