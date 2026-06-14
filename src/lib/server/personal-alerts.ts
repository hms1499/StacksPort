// src/lib/server/personal-alerts.ts
// Turns deterministic signals into client-facing alerts. templateAlerts() is
// the deterministic fallback (and the source of truth for type/priority
// mapping); generatePersonalAlerts() (Task 5) asks Groq to phrase them and
// falls back here on any failure.
import type { PersonalAlert } from "@/lib/ai-portfolio";
import type { AlertActionKind } from "@/lib/ai";
import { parsePersonalAlerts } from "./personal-alerts-schema";
import { completeJSON } from "./groq-client";
import { languageDirective } from "./ai-language";
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

// Signal kind → deep-link CTA. Derived from the trusted detector `kind`, never
// from LLM text, so the destination is always correct. Kinds with no obvious
// in-app action (sbtc-depeg is a "be cautious" warning) are intentionally
// absent → no CTA.
const ACTION_BY_KIND: Partial<Record<SignalKind, AlertActionKind>> = {
  "dca-runway-low": "dca-open",
  "dca-balance-empty": "dca-open",
  "dca-dip-buy": "dca-open",
  "pnl-gain": "view-assets",
  "pnl-loss": "view-assets",
};

export function actionForKind(kind: SignalKind): AlertActionKind | undefined {
  return ACTION_BY_KIND[kind];
}

function template(sig: PortfolioSignal): PersonalAlert {
  const base = templateBody(sig);
  const action = ACTION_BY_KIND[sig.kind];
  return action ? { ...base, action } : base;
}

function templateBody(sig: PortfolioSignal): PersonalAlert {
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
    {"title": "short title", "description": "1-2 sentences", "type": "opportunity|warning|info", "priority": "high|medium|low", "signalKind": "<the kind of the signal this alert is based on>"}
  ]
}

Rules:
- Use ONLY numbers that appear in the signal facts. Never compute or invent figures.
- Keep priority consistent with each signal's severity.
- Set "signalKind" to the exact "kind" value of the signal each alert is based on (e.g. "dca-runway-low"). This is used to attach the right in-app action.
- Be concise and actionable. Return ONLY valid JSON.`;
}

export async function generatePersonalAlerts(
  signals: PortfolioSignal[],
  market: MarketContext,
  locale = "en"
): Promise<PersonalAlert[]> {
  if (signals.length === 0) return [];
  // No API key → skip the (throwing) Groq call and use the deterministic copy.
  // NOTE: that template fallback stays English; only the LLM-phrased path is
  // localized (the templates interpolate numbers into fixed English strings).
  if (!process.env.GROQ_API_KEY) return templateAlerts(signals);

  try {
    const { alerts } = parsePersonalAlerts(
      await completeJSON({
        system: "You are a crypto portfolio analyst. Respond with valid JSON only.",
        prompt: buildPrompt(signals, market) + languageDirective(locale),
        maxTokens: 1024,
        label: "Portfolio Alerts",
      })
    );
    // Resolve the CTA from the trusted detector kind the model echoed back —
    // the model never supplies the URL, only classifies which signal it used.
    // An absent/unknown signalKind simply yields no CTA.
    const withActions = alerts.map(({ signalKind, ...alert }) => {
      const action = signalKind ? ACTION_BY_KIND[signalKind] : undefined;
      return action ? { ...alert, action } : alert;
    });
    // If the model returned nothing usable, fall back rather than show an empty section.
    return withActions.length > 0 ? withActions : templateAlerts(signals);
  } catch (err) {
    console.warn("[Portfolio Alerts] generation failed, using template fallback:", err);
    return templateAlerts(signals);
  }
}
