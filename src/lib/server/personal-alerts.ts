// src/lib/server/personal-alerts.ts
// Turns deterministic signals into client-facing alerts. templateAlerts() is
// the deterministic fallback (and the source of truth for type/priority
// mapping); generatePersonalAlerts() (Task 5) asks Groq to phrase them and
// falls back here on any failure.
import type { PersonalAlert } from "@/lib/ai-portfolio";
import type { PortfolioSignal, SignalKind } from "./portfolio-signals";

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
        description: `Balance ${f.balance} is below the ${f.amtPerSwap} per-swap amount. Add funds to resume.` };
    case "dca-dip-buy":
      return { type, priority, title: `Buying the dip`,
        description: `Fear & Greed is ${f.fearGreedValue} (${f.classification}) and your ${f.planCount} active DCA plan(s) are accumulating into weakness.` };
    case "pnl-gain":
      return { type, priority, title: `${f.symbol} up ${f.unrealizedPct}%`,
        description: `${f.symbol}: unrealized +$${f.unrealizedPnL} on a $${f.currentValue} position. Consider whether to take some profit.` };
    case "pnl-loss":
      return { type, priority, title: `${f.symbol} down ${f.unrealizedPct}%`,
        description: `Unrealized $${f.unrealizedPnL}. Review your thesis or DCA level.` };
    case "sbtc-depeg":
      return { type, priority, title: `sBTC off peg`,
        description: `sBTC is ${f.deviationPct}% from BTC (≈$${f.pegPrice}). Be cautious with sBTC swaps right now.` };
  }
}

export function templateAlerts(signals: PortfolioSignal[]): PersonalAlert[] {
  return signals.map(template);
}
