// src/lib/server/portfolio-signals.ts
// Pure deterministic detectors: portfolio + market facts → structured signals
// with REAL numbers. The LLM phrasing layer only references these numbers; it
// never computes them, so a hallucinating model can't misstate balances/PnL.
import type { DCAPlan } from "@/lib/dca";
import type { PnLData, SBTCData } from "@/lib/stacks";

// Structurally identical to market-snapshot's `FearGreed`, declared locally on
// purpose: this module stays a pure, dependency-free detector and does not
// import from the heavy market-snapshot aggregator. Structural typing lets the
// route pass a `FearGreed` straight in.
export interface FearGreedLite {
  value: number;
  classification: string;
}

export type SignalKind =
  | "dca-runway-low"
  | "dca-balance-empty"
  | "dca-dip-buy"
  | "pnl-gain"
  | "pnl-loss"
  | "sbtc-depeg";

export interface PortfolioSignal {
  kind: SignalKind;
  severity: "high" | "medium" | "low";
  facts: Record<string, string | number>;
}

export interface SignalInput {
  dcaPlans: DCAPlan[] | null;
  pnl: PnLData | null;
  sbtcData: SBTCData | null;
  fearGreed: FearGreedLite | null;
}

// Nakamoto Stacks produces ~6.5 blocks/min (see INTERVALS in src/lib/dca.ts).
const BLOCKS_PER_DAY = 6.5 * 60 * 24; // 9360
const MAX_SIGNALS = 6;
const DUST_USD = 1;
const SEVERITY_ORDER: Record<PortfolioSignal["severity"], number> = { high: 0, medium: 1, low: 2 };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function detectSignals(input: SignalInput): PortfolioSignal[] {
  const signals: PortfolioSignal[] = [];
  const activePlans = (input.dcaPlans ?? []).filter((p) => p.active);

  // DCA runway / balance-empty (mutually exclusive per plan)
  for (const p of activePlans) {
    if (p.amt <= 0) continue;
    const swapsLeft = Math.floor(p.bal / p.amt);
    if (swapsLeft < 1) {
      signals.push({
        kind: "dca-balance-empty",
        severity: "high",
        facts: { planId: p.id, balance: p.bal, amtPerSwap: p.amt },
      });
    } else if (swapsLeft <= 3) {
      signals.push({
        kind: "dca-runway-low",
        severity: swapsLeft <= 1 ? "high" : "medium",
        facts: { planId: p.id, swapsLeft, daysLeft: round1((swapsLeft * p.ivl) / BLOCKS_PER_DAY) },
      });
    }
  }

  // Dip-buy: market in fear AND user is actively accumulating
  if (input.fearGreed && input.fearGreed.value <= 25 && activePlans.length > 0) {
    signals.push({
      kind: "dca-dip-buy",
      severity: "low",
      facts: {
        fearGreedValue: input.fearGreed.value,
        classification: input.fearGreed.classification,
        planCount: activePlans.length,
      },
    });
  }

  // PnL milestones
  for (const e of input.pnl?.entries ?? []) {
    if (e.currentValue < DUST_USD) continue;
    if (e.unrealizedPct >= 20) {
      signals.push({
        kind: "pnl-gain",
        severity: e.unrealizedPct >= 50 ? "medium" : "low",
        facts: {
          symbol: e.symbol,
          unrealizedPct: round1(e.unrealizedPct),
          unrealizedPnL: Math.round(e.unrealizedPnL),
          currentValue: Math.round(e.currentValue),
        },
      });
    } else if (e.unrealizedPct <= -20) {
      signals.push({
        kind: "pnl-loss",
        severity: e.unrealizedPct <= -40 ? "high" : "medium",
        facts: {
          symbol: e.symbol,
          unrealizedPct: round1(e.unrealizedPct),
          unrealizedPnL: Math.round(e.unrealizedPnL),
        },
      });
    }
  }

  // sBTC depeg (only relevant if the user holds sBTC)
  const peg = input.sbtcData?.peg;
  if (input.sbtcData && input.sbtcData.balance > 0 && peg && peg.status !== "pegged") {
    signals.push({
      kind: "sbtc-depeg",
      severity: peg.status === "depegged" ? "high" : "low",
      facts: {
        deviationPct: round1(peg.deviation),
        pegPrice: Math.round(peg.sbtcPrice),
        balance: input.sbtcData.balance,
      },
    });
  }

  return signals
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_SIGNALS);
}
