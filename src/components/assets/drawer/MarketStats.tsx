"use client";

import { useTokenMarketStats } from "@/hooks/useMarketData";
import { formatUSD } from "@/lib/utils";

function formatPrice(n: number): string {
  if (n === 0) return "—";
  if (n >= 1000) return formatUSD(n);
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

function formatCompactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function MarketStats({ geckoId }: { geckoId: string }) {
  const { data, isLoading } = useTokenMarketStats(geckoId);

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-2 gap-2 mt-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 rounded-xl animate-pulse"
            style={{ backgroundColor: "var(--border-subtle)" }}
            aria-hidden
          />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const cells: Array<{ label: string; value: string }> = [
    { label: "24h High", value: formatPrice(data.high24h ?? 0) },
    { label: "24h Low", value: formatPrice(data.low24h ?? 0) },
    { label: "24h Volume", value: formatCompactUsd(data.volume24h) },
    { label: "Market Cap", value: formatCompactUsd(data.marketCap) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        >
          <p
            className="text-[10px] uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            {c.label}
          </p>
          <p
            className="text-sm font-semibold font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
