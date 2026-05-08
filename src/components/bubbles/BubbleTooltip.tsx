"use client";

import { useEffect, useRef } from "react";
import type { BubbleToken } from "@/hooks/useBubblesData";
import type { Timeframe } from "./TimeframeToggle";

function fmtUsd(v: number): string {
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`;
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

function fmtPrice(v: number): string {
  if (v >= 1) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${v.toFixed(6)}`;
}

function getChange(token: BubbleToken, tf: Timeframe): number {
  if (tf === "1h") return token.change1h;
  if (tf === "7d") return token.change7d;
  return token.change24h;
}

interface BubbleTooltipProps {
  token: BubbleToken;
  x: number;
  y: number;
  timeframe: Timeframe;
  onClose: () => void;
}

export default function BubbleTooltip({
  token,
  x,
  y,
  timeframe,
  onClose,
}: BubbleTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const tooltipWidth = 200;
  const tooltipHeight = 160;
  let left = x + 12;
  let top = y - tooltipHeight / 2;

  if (typeof window !== "undefined") {
    if (left + tooltipWidth > window.innerWidth - 16) left = x - tooltipWidth - 12;
    if (top < 8) top = 8;
    if (top + tooltipHeight > window.innerHeight - 8) top = window.innerHeight - tooltipHeight - 8;
  }

  const change = getChange(token, timeframe);
  const isPositive = change >= 0;

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-xl border shadow-2xl p-3 min-w-[200px]"
      style={{
        left,
        top,
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={token.image} alt={token.symbol} className="w-6 h-6 rounded-full" />
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {token.name}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {token.symbol}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span style={{ color: "var(--text-muted)" }}>Price</span>
          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {fmtPrice(token.price)}
          </div>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>
            {timeframe.toUpperCase()}
          </span>
          <div
            className="font-semibold"
            style={{ color: isPositive ? "#34d399" : "#f87171" }}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(1)}%
          </div>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>MCap</span>
          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {fmtUsd(token.marketCap)}
          </div>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Vol 24h</span>
          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {fmtUsd(token.volume24h)}
          </div>
        </div>
      </div>
    </div>
  );
}
