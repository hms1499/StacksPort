// src/lib/server/personal-alerts.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { templateAlerts } from "./personal-alerts";
import type { PortfolioSignal } from "./portfolio-signals";

describe("templateAlerts", () => {
  it("returns [] for no signals", () => {
    expect(templateAlerts([])).toEqual([]);
  });

  it("maps each kind to the right type/priority and references its numbers", () => {
    const signals: PortfolioSignal[] = [
      { kind: "dca-runway-low", severity: "medium", facts: { planId: 3, swapsLeft: 2, daysLeft: 1.5 } },
      { kind: "dca-balance-empty", severity: "high", facts: { planId: 4, balance: 500000, amtPerSwap: 1000000 } },
      { kind: "dca-dip-buy", severity: "low", facts: { fearGreedValue: 18, classification: "Extreme Fear", planCount: 2 } },
      { kind: "pnl-gain", severity: "low", facts: { symbol: "ALEX", unrealizedPct: 32, unrealizedPnL: 40, currentValue: 160 } },
      { kind: "pnl-loss", severity: "high", facts: { symbol: "WELSH", unrealizedPct: -45, unrealizedPnL: -90 } },
      { kind: "sbtc-depeg", severity: "high", facts: { deviationPct: -6, pegPrice: 94000, balance: 1000 } },
    ];
    const out = templateAlerts(signals);
    expect(out).toHaveLength(6);

    const runway = out[0];
    expect(runway.type).toBe("warning");
    expect(runway.priority).toBe("medium");
    expect(runway.title).toContain("3");        // planId
    expect(runway.description).toContain("1.5"); // daysLeft

    expect(out[2].type).toBe("opportunity");     // dip-buy
    expect(out[3].type).toBe("opportunity");     // pnl-gain
    expect(out[3].description).toContain("ALEX");
    expect(out[4].type).toBe("warning");         // pnl-loss
    expect(out[5].type).toBe("warning");         // depeg
  });
});

import { generatePersonalAlerts } from "./personal-alerts";

describe("generatePersonalAlerts (no API key)", () => {
  const prev = process.env.GROQ_API_KEY;
  beforeEach(() => { delete process.env.GROQ_API_KEY; });
  afterEach(() => { if (prev) process.env.GROQ_API_KEY = prev; });

  it("returns [] for no signals without calling Groq", async () => {
    expect(await generatePersonalAlerts([], { fearGreed: null, stxChange24h: null })).toEqual([]);
  });

  it("falls back to templated alerts when no API key is set", async () => {
    const out = await generatePersonalAlerts(
      [{ kind: "dca-balance-empty", severity: "high", facts: { planId: 4, balance: 1, amtPerSwap: 2 } }],
      { fearGreed: null, stxChange24h: null }
    );
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("warning");
  });
});
