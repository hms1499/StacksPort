// src/lib/server/chat-context.ts
// Pure: turns the live market snapshot (+ optional portfolio snapshot) into a
// compact, factual plain-text block injected as the chat system prompt. Every
// number here comes from real snapshot data — the model is told to use only
// these figures, mirroring the anti-hallucination posture of the insights and
// personal-alerts paths. Defensive on null/missing fields: degrades to "N/A",
// never throws.
import type { MarketSnapshot } from "./market-snapshot";
import type { PortfolioSnapshot } from "./portfolio-snapshot";
import { microToSTX, blocksToInterval } from "@/lib/dca";

function num(n: number | null | undefined, digits = 2): string {
  return n === null || n === undefined || Number.isNaN(n) ? "N/A" : n.toFixed(digits);
}

function marketSection(m: MarketSnapshot): string {
  const s = m.stxStats;
  const fg = m.fearGreed;
  const btc = m.swapPrices?.bitcoin?.usd ?? null;
  const trending = (m.trending ?? []).slice(0, 5).map((t) => t.symbol).join(", ") || "N/A";
  const sevenD =
    m.stxHistory7d && m.stxHistory7d.prices.length >= 2
      ? `${(((m.stxHistory7d.prices[m.stxHistory7d.prices.length - 1] - m.stxHistory7d.prices[0]) / m.stxHistory7d.prices[0]) * 100).toFixed(2)}%`
      : "N/A";
  return [
    "## Market (live)",
    `- STX price: $${num(s?.price, 4)} (24h ${num(s?.change24h)}%, 7d ${sevenD})`,
    `- STX market cap: $${s ? (s.marketCap / 1e6).toFixed(1) + "M" : "N/A"}, 24h volume: $${s ? (s.volume24h / 1e6).toFixed(1) + "M" : "N/A"}`,
    `- BTC price: $${num(btc, 0)}`,
    `- Fear & Greed: ${fg ? `${fg.value} (${fg.classification})` : "N/A"}`,
    `- Trending tokens: ${trending}`,
  ].join("\n");
}

function portfolioSection(p: PortfolioSnapshot): string {
  const lines: string[] = ["## Your portfolio (connected wallet)"];
  const v = p.portfolio;
  if (v) {
    lines.push(`- Total value: $${num(v.totalUSD)} (STX $${num(v.stxUSD)}, other $${num(v.otherUSD)})`);
    lines.push(`- STX balance: ${num(v.stxHumanBalance, 4)} STX`);
  }
  const plans = (p.dcaPlans ?? []).filter((d) => d.active);
  if (plans.length > 0) {
    lines.push("- Active DCA plans:");
    for (const d of plans) {
      const target = d.token.split(".")[1] ?? d.token;
      lines.push(
        `  - #${d.id}: ${num(microToSTX(d.amt), 2)} STX -> ${target} every ${blocksToInterval(d.ivl)}; balance ${num(microToSTX(d.bal), 2)} STX; ${d.tsd} swaps done`
      );
    }
  } else {
    lines.push("- Active DCA plans: none");
  }
  const entries = p.pnl?.entries ?? [];
  if (entries.length > 0) {
    lines.push("- Holdings PnL:");
    for (const e of entries.slice(0, 6)) {
      lines.push(
        `  - ${e.symbol}: value $${num(e.currentValue)}, unrealized ${e.unrealizedPnL >= 0 ? "+" : ""}$${num(e.unrealizedPnL)} (${num(e.unrealizedPct)}%)`
      );
    }
  }
  return lines.join("\n");
}

export function buildChatContext(
  market: MarketSnapshot,
  portfolio: PortfolioSnapshot | null
): string {
  const parts = [marketSection(market)];
  if (portfolio) {
    parts.push(portfolioSection(portfolio));
  } else {
    parts.push("## Your portfolio\n- No wallet connected. Portfolio-specific data is unavailable until the user connects a wallet.");
  }
  return parts.join("\n\n");
}
