"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import type { BubbleToken } from "@/hooks/useBubblesData";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { Timeframe } from "./TimeframeToggle";
import Sparkline from "./Sparkline";

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

// Maps CoinGecko coin id → SwapWidget token id when the token is tradeable on Bitflow.
const COINGECKO_TO_SWAP_ID: Record<string, string> = {
  blockstack: "stx",
  "sbtc-2": "sbtc",
};

function getSwapHref(coingeckoId: string): string {
  const swapId = COINGECKO_TO_SWAP_ID[coingeckoId];
  if (!swapId) return "/trade";
  // Intent: acquire this token, so it's the destination.
  const fromId = swapId === "stx" ? "sbtc" : "stx";
  return `/trade?from=${fromId}&to=${swapId}`;
}

function getChange(token: BubbleToken, tf: Timeframe): number {
  if (tf === "1h") return token.change1h;
  if (tf === "7d") return token.change7d;
  if (tf === "30d") return token.change30d;
  if (tf === "1y") return token.change1y;
  return token.change24h;
}

interface BubbleTooltipProps {
  token: BubbleToken;
  x: number;
  y: number;
  timeframe: Timeframe;
  onClose: () => void;
}

const CARD_W = 280;
const CARD_H = 320;

export default function BubbleTooltip({
  token,
  x,
  y,
  timeframe,
  onClose,
}: BubbleTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { has: isStarred, toggle: toggleStar } = useWatchlist();
  const starred = isStarred(token.id);

  useEffect(() => {
    setImgError(false);
  }, [token.id]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

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

  let left = x + 12;
  let top = y - CARD_H / 2;

  if (!isMobile && typeof window !== "undefined") {
    if (left + CARD_W > window.innerWidth - 16) left = x - CARD_W - 12;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    if (top + CARD_H > window.innerHeight - 8) top = window.innerHeight - CARD_H - 8;
  }

  const change = getChange(token, timeframe);
  const isPositive = change >= 0;
  const accent = isPositive ? "#34d399" : "#f87171";

  const sparklineWidth = isMobile
    ? typeof window !== "undefined"
      ? Math.min(window.innerWidth - 56, 600)
      : 320
    : CARD_W - 20;

  return (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden
        />
      )}
      <div
        ref={ref}
        className={
          isMobile
            ? "fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl border-t border-x shadow-2xl overflow-hidden animate-[slideUp_180ms_ease-out]"
            : "fixed z-50 rounded-2xl border shadow-2xl overflow-hidden"
        }
        style={
          isMobile
            ? {
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-subtle)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }
            : {
                left,
                top,
                width: CARD_W,
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-subtle)",
              }
        }
      >
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1">
            <div
              className="h-1 w-10 rounded-full"
              style={{ backgroundColor: "var(--border-subtle)" }}
            />
          </div>
        )}
      <div className="p-3.5">
        <div className="flex items-center gap-2.5 mb-3">
          {!imgError && token.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={token.image}
              alt={token.symbol}
              className="w-8 h-8 rounded-full"
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}
            >
              {token.symbol.slice(0, 2)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
              {token.name}
              {token.isStacks && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ backgroundColor: "rgba(64,138,113,0.18)", color: "#5fb594" }}
                >
                  STACKS
                </span>
              )}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {token.symbol}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleStar(token.id)}
            aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
            aria-pressed={starred}
            className="p-1.5 rounded-md transition-colors hover:bg-white/5"
            title={starred ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star
              size={16}
              strokeWidth={2}
              fill={starred ? "#fbbf24" : "transparent"}
              color={starred ? "#fbbf24" : "var(--text-muted)"}
            />
          </button>
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {fmtPrice(token.price)}
          </div>
          <div className="text-sm font-semibold" style={{ color: accent }}>
            {isPositive ? "+" : ""}
            {change.toFixed(2)}% · {timeframe.toUpperCase()}
          </div>
        </div>

        <div className="-mx-1 mb-3">
          <Sparkline data={token.sparkline7d} width={sparklineWidth} height={isMobile ? 72 : 56} />
          <div className="text-[10px] mt-0.5 px-1" style={{ color: "var(--text-muted)" }}>
            7d price
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mb-3">
          <Stat label="MCap" value={fmtUsd(token.marketCap)} />
          <Stat label="Vol 24h" value={fmtUsd(token.volume24h)} />
          <Stat label="30d" value={`${token.change30d >= 0 ? "+" : ""}${token.change30d.toFixed(1)}%`} color={token.change30d >= 0 ? "#34d399" : "#f87171"} />
          <Stat label="1y" value={`${token.change1y >= 0 ? "+" : ""}${token.change1y.toFixed(1)}%`} color={token.change1y >= 0 ? "#34d399" : "#f87171"} />
        </div>

        <div className="flex gap-2">
          {token.isStacks && COINGECKO_TO_SWAP_ID[token.id] ? (
            <Link
              href={getSwapHref(token.id)}
              className="flex-1 text-center text-xs font-semibold py-2 rounded-lg transition-colors"
              style={{ backgroundColor: "#408A71", color: "white" }}
            >
              Swap on Bitflow
            </Link>
          ) : token.isStacks ? (
            <a
              href="https://app.bitflow.finance/trade"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs font-semibold py-2 rounded-lg transition-colors"
              style={{ backgroundColor: "#408A71", color: "white" }}
            >
              Trade on Bitflow ↗
            </a>
          ) : (
            <a
              href={`https://www.coingecko.com/en/coins/${token.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs font-semibold py-2 rounded-lg transition-colors"
              style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-primary)" }}
            >
              View on CoinGecko
            </a>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-semibold" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}
