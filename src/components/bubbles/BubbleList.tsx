"use client";

import type { BubbleToken } from "@/hooks/useBubblesData";
import type { Timeframe } from "./TimeframeToggle";

interface BubbleListProps {
  tokens: BubbleToken[];
  timeframe: Timeframe;
  heldIds?: Set<string>;
  selectedId?: string | null;
  onRowClick: (token: BubbleToken, x: number, y: number) => void;
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`;
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtPrice(v: number): string {
  if (v >= 1)
    return `$${v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  return `$${v.toFixed(6)}`;
}

function getChange(t: BubbleToken, tf: Timeframe): number {
  if (tf === "1h") return t.change1h;
  if (tf === "7d") return t.change7d;
  if (tf === "30d") return t.change30d;
  if (tf === "1y") return t.change1y;
  return t.change24h;
}

export default function BubbleList({
  tokens,
  timeframe,
  heldIds,
  selectedId,
  onRowClick,
}: BubbleListProps) {
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10" style={{ backgroundColor: "var(--bg-base)" }}>
          <tr style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase">
            <th className="text-left px-3 py-2 font-medium">#</th>
            <th className="text-left px-2 py-2 font-medium">Token</th>
            <th className="text-right px-2 py-2 font-medium">Price</th>
            <th className="text-right px-2 py-2 font-medium">{timeframe.toUpperCase()}</th>
            <th className="text-right px-2 py-2 font-medium hidden sm:table-cell">MCap</th>
            <th className="text-right px-3 py-2 font-medium hidden md:table-cell">Vol 24h</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t, i) => {
            const c = getChange(t, timeframe);
            const positive = c >= 0;
            const held = heldIds?.has(t.id);
            const isSelected = selectedId === t.id;
            return (
              <tr
                key={t.id}
                onClick={(e) => onRowClick(t, e.clientX, e.clientY)}
                className="cursor-pointer hover:bg-white/[0.03]"
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  backgroundColor: isSelected
                    ? "rgba(64,138,113,0.12)"
                    : undefined,
                }}
              >
                <td className="px-3 py-2 font-mono" style={{ color: "var(--text-muted)" }}>
                  {i + 1}
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {t.symbol}
                    </span>
                    {t.isStacks && (
                      <span
                        className="text-[9px] px-1 py-0.5 rounded font-semibold"
                        style={{
                          backgroundColor: "rgba(64,138,113,0.18)",
                          color: "#5fb594",
                        }}
                      >
                        STX
                      </span>
                    )}
                    {held && (
                      <span
                        className="text-[9px] px-1 py-0.5 rounded font-semibold"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.08)",
                          color: "var(--text-muted)",
                        }}
                      >
                        HELD
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className="px-2 py-2 text-right font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {fmtPrice(t.price)}
                </td>
                <td
                  className="px-2 py-2 text-right font-mono font-semibold"
                  style={{ color: positive ? "#34d399" : "#f87171" }}
                >
                  {positive ? "+" : ""}
                  {c.toFixed(2)}%
                </td>
                <td
                  className="px-2 py-2 text-right font-mono hidden sm:table-cell"
                  style={{ color: "var(--text-muted)" }}
                >
                  {fmtUsd(t.marketCap)}
                </td>
                <td
                  className="px-3 py-2 text-right font-mono hidden md:table-cell"
                  style={{ color: "var(--text-muted)" }}
                >
                  {fmtUsd(t.volume24h)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
