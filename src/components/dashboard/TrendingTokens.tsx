"use client";

import { memo } from "react";
import { Info, ChevronRight } from "lucide-react";
import { useTrendingTokens } from "@/hooks/useMarketData";
import { useFlashOnChange } from "@/hooks/useFlashOnChange";
import PriceSparkline from "@/components/dashboard/PriceSparkline";
import type { TrendingToken } from "@/lib/stacks";

const COINGECKO_STACKS_URL = "https://www.coingecko.com/en/categories/stacks-ecosystem";

const Sparkline = ({ prices, isPositive }: { prices: number[]; isPositive: boolean }) => (
  <PriceSparkline
    prices={prices}
    isPositive={isPositive}
    interactive
    formatValue={formatPrice}
    width={80}
    height={40}
    className="w-20 h-10"
  />
);

function formatPrice(price: number): string {
  if (price === 0) return "—";
  if (price >= 1000) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.001) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

const TokenRow = memo(function TokenRow({ token }: { token: TrendingToken }) {
  const isPositive = token.change24h >= 0;
  const priceFlash = useFlashOnChange(token.priceUsd);

  return (
    <a
      href={`https://www.coingecko.com/en/coins/${token.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 rounded-xl px-2 -mx-2 transition-colors cursor-pointer"
      style={{ ['--hover-bg' as string]: 'var(--bg-elevated)' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--bg-elevated)' }}>
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
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{token.name}</p>
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{token.symbol}</p>
      </div>

      {/* Sparkline — hide on narrow containers to give the name room */}
      <div className="flex-shrink-0 hidden @[360px]:block">
        <Sparkline prices={token.sparkline} isPositive={isPositive} />
      </div>

      {/* Price + change */}
      <div className="text-right flex-shrink-0 w-24">
        <p className={`text-sm font-semibold ${priceFlash}`} style={{ color: 'var(--text-primary)' }}>{formatPrice(token.priceUsd)}</p>
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
});

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-2">
      <div className="w-11 h-11 rounded-full shrink-0 skeleton" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 rounded w-24 skeleton" />
        <div className="h-3 rounded w-12 skeleton" />
      </div>
      <div className="w-20 h-10 rounded shrink-0 skeleton" />
      <div className="w-24 space-y-1.5 text-right">
        <div className="h-3 rounded w-16 ml-auto skeleton" />
        <div className="h-3 rounded w-12 ml-auto skeleton" />
      </div>
    </div>
  );
}

export default function TrendingTokens() {
  const { data: tokens, isLoading } = useTrendingTokens();

  return (
    <div
      className="@container glass-card rounded-2xl p-5 shadow-sm"
      style={{ ['--card-accent' as string]: '#FB7185' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Trending</h2>
          <Info size={13} style={{ color: 'var(--text-muted)' }} />
        </div>
        <a
          href={COINGECKO_STACKS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-0.5 text-sm transition-colors font-medium"
          style={{ color: 'var(--accent)' }}
        >
          See all <ChevronRight size={15} />
        </a>
      </div>

      {/* Token rows */}
      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {isLoading
          ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
          : (tokens ?? []).slice(0, 5).map((token) => <TokenRow key={token.id} token={token} />)}
      </div>
    </div>
  );
}
