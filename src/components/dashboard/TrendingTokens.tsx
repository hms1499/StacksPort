"use client";

import { useEffect, useState } from "react";
import { Info, ChevronRight } from "lucide-react";
import { getTrendingTokens, TrendingToken } from "@/lib/stacks";

const COINGECKO_STACKS_URL = "https://www.coingecko.com/en/categories/stacks-ecosystem";

function Sparkline({ prices, isPositive }: { prices: number[]; isPositive: boolean }) {
  if (prices.length < 2) {
    return <div className="w-20 h-10" />;
  }

  const w = 80;
  const h = 40;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const strokeColor = isPositive ? "#22c55e" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-10" preserveAspectRatio="none">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatPrice(price: number): string {
  if (price === 0) return "—";
  if (price >= 1000) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.001) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function TokenRow({ token }: { token: TrendingToken }) {
  const isPositive = token.change24h >= 0;

  return (
    <a
      href={`https://www.coingecko.com/en/coins/${token.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 hover:bg-gray-50 rounded-xl px-2 -mx-2 transition-colors cursor-pointer"
    >
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
        {token.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={token.image} alt={token.symbol} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs font-bold text-gray-500">{token.symbol.slice(0, 3)}</span>
          </div>
        )}
      </div>

      {/* Name + symbol */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{token.name}</p>
        <p className="text-xs text-gray-400 font-medium">{token.symbol}</p>
      </div>

      {/* Sparkline */}
      <div className="flex-shrink-0">
        <Sparkline prices={token.sparkline} isPositive={isPositive} />
      </div>

      {/* Price + change */}
      <div className="text-right flex-shrink-0 w-24">
        <p className="text-sm font-semibold text-gray-900">{formatPrice(token.priceUsd)}</p>
        <div
          className={`flex items-center justify-end gap-0.5 mt-0.5 text-xs font-medium ${
            isPositive ? "text-green-500" : "text-red-500"
          }`}
        >
          <span
            className="inline-block"
            style={{
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              ...(isPositive
                ? { borderBottom: `5px solid currentColor` }
                : { borderTop: `5px solid currentColor` }),
            }}
          />
          <span>{Math.abs(token.change24h).toFixed(3)}%</span>
        </div>
      </div>
    </a>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-2 animate-pulse">
      <div className="w-11 h-11 rounded-full bg-gray-100 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded w-24" />
        <div className="h-3 bg-gray-100 rounded w-12" />
      </div>
      <div className="w-20 h-10 bg-gray-100 rounded flex-shrink-0" />
      <div className="w-24 space-y-1.5 text-right">
        <div className="h-3 bg-gray-100 rounded w-16 ml-auto" />
        <div className="h-3 bg-gray-100 rounded w-12 ml-auto" />
      </div>
    </div>
  );
}

export default function TrendingTokens() {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrendingTokens()
      .then(setTokens)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h2 className="font-semibold text-gray-700">Trending</h2>
          <Info size={13} className="text-gray-400" />
        </div>
        <a
          href={COINGECKO_STACKS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-0.5 text-sm text-teal-500 hover:text-teal-600 transition-colors font-medium"
        >
          See all <ChevronRight size={15} />
        </a>
      </div>

      {/* Token rows */}
      <div className="divide-y divide-gray-50">
        {loading
          ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
          : tokens.slice(0, 5).map((token) => <TokenRow key={token.id} token={token} />)}
      </div>
    </div>
  );
}
