"use client";

import { useMemo } from "react";
import { type TokenWithValue } from "@/lib/stacks";
import { usePnLData } from "@/hooks/useMarketData";
import { useWalletStore } from "@/store/walletStore";
import { formatUSD } from "@/lib/utils";

function formatPrice(n: number): string {
  if (n === 0) return "—";
  if (n >= 1000) return formatUSD(n);
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

export default function PnL({
  token,
  isSTX,
}: {
  token: TokenWithValue;
  isSTX: boolean;
}) {
  const { stxAddress, isConnected } = useWalletStore();
  const { data } = usePnLData(isConnected && stxAddress ? stxAddress : undefined);

  const entry = useMemo(() => {
    if (!data?.entries) return null;
    if (isSTX) return data.entries.find((e) => e.symbol === "STX") ?? null;
    const id = token.contractId;
    if (!id) return null;
    return (
      data.entries.find((e) => e.contractId === id) ??
      // Fallback: PnL builder strips "::asset" suffix; holdings sometimes carry it
      data.entries.find((e) => e.contractId === id.split("::")[0]) ??
      null
    );
  }, [data, isSTX, token.contractId]);

  if (!entry) return null;
  if (entry.totalCost === 0 && entry.realizedPnL === 0) return null;

  const unrealized = entry.unrealizedPnL;
  const unrealizedPositive = unrealized >= 0;
  const hasRealized = Math.abs(entry.realizedPnL) >= 0.005;

  return (
    <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <p
        className="text-xs uppercase tracking-wide mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        Position PnL
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        >
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Avg Cost
          </p>
          <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
            {formatPrice(entry.avgCostBasis)}
          </p>
        </div>
        <div
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        >
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Cost Basis
          </p>
          <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
            {formatUSD(entry.totalCost)}
          </p>
        </div>
        <div
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        >
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Unrealized
          </p>
          <p
            className={`text-sm font-semibold font-mono ${unrealizedPositive ? "text-green-500" : "text-red-500"}`}
          >
            {unrealizedPositive ? "+" : "−"}
            {formatUSD(Math.abs(unrealized))}
            <span className="text-[11px] font-normal ml-1" style={{ color: "var(--text-muted)" }}>
              ({unrealizedPositive ? "+" : ""}
              {entry.unrealizedPct.toFixed(2)}%)
            </span>
          </p>
        </div>
        <div
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        >
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Realized
          </p>
          {hasRealized ? (
            <p
              className={`text-sm font-semibold font-mono ${entry.realizedPnL >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {entry.realizedPnL >= 0 ? "+" : "−"}
              {formatUSD(Math.abs(entry.realizedPnL))}
            </p>
          ) : (
            <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-muted)" }}>
              —
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
