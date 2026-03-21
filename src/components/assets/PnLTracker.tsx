"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, BarChart3, Info } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { getPnLData, PnLData, PnLEntry } from "@/lib/stacks";
import { formatUSD } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPnL(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${formatUSD(Math.abs(n))}`;
}

function formatPrice(n: number): string {
  if (n === 0) return "—";
  if (n >= 1000) return formatUSD(n);
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

function pnlColor(n: number): string {
  return n >= 0 ? "text-green-500" : "text-red-500";
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  pct,
}: {
  label: string;
  value: number;
  pct?: number;
}) {
  const isPos = value >= 0;
  const Icon = isPos ? TrendingUp : TrendingDown;
  const colorClass = isPos ? "text-green-500" : "text-red-500";
  const bgClass = isPos ? "bg-green-50" : "bg-red-50";

  return (
    <div className={`rounded-xl p-4 ${bgClass}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className={colorClass} />
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
      <p className={`text-xl font-bold ${colorClass}`}>{formatPnL(value)}</p>
      {pct !== undefined && (
        <p className={`text-xs mt-0.5 font-medium ${colorClass}`}>
          {pct >= 0 ? "+" : ""}
          {pct.toFixed(2)}%
        </p>
      )}
    </div>
  );
}

// ─── Token Avatar ─────────────────────────────────────────────────────────────

function TokenAvatar({ symbol, imageUri }: { symbol: string; imageUri?: string }) {
  const [err, setErr] = useState(false);
  if (imageUri && !err) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-50 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUri} alt={symbol} className="w-full h-full object-cover" onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-teal-600">{symbol.slice(0, 3)}</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-20" />
            <div className="h-6 bg-gray-200 rounded w-28" />
            <div className="h-3 bg-gray-200 rounded w-14" />
          </div>
        ))}
      </div>
      <div className="space-y-0 divide-y divide-gray-50">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
              <div className="h-3 bg-gray-100 rounded w-16" />
            </div>
            {[...Array(5)].map((_, j) => (
              <div key={j} className="h-3 bg-gray-100 rounded w-14 ml-auto self-center" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PnL Row ──────────────────────────────────────────────────────────────────

function PnLRow({ entry }: { entry: PnLEntry }) {
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 py-3.5 hover:bg-gray-50 transition-colors items-center border-b border-gray-50 last:border-0">
      {/* Token */}
      <div className="flex items-center gap-2.5 min-w-0">
        <TokenAvatar symbol={entry.symbol} imageUri={entry.imageUri} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{entry.symbol}</p>
          <p className="text-xs text-gray-400 truncate">{entry.name}</p>
        </div>
      </div>

      {/* Avg Cost */}
      <p className="text-sm text-gray-600 text-right tabular-nums">
        {entry.avgCostBasis > 0 ? formatPrice(entry.avgCostBasis) : "—"}
      </p>

      {/* Current Price */}
      <p className="text-sm text-gray-600 text-right tabular-nums">
        {formatPrice(entry.currentPrice)}
      </p>

      {/* Unrealized PnL */}
      <div className="text-right">
        <p className={`text-sm font-medium tabular-nums ${pnlColor(entry.unrealizedPnL)}`}>
          {formatPnL(entry.unrealizedPnL)}
        </p>
        {entry.totalCost > 0 && (
          <p className={`text-[11px] tabular-nums ${pnlColor(entry.unrealizedPct)}`}>
            {entry.unrealizedPct >= 0 ? "+" : ""}
            {entry.unrealizedPct.toFixed(1)}%
          </p>
        )}
      </div>

      {/* Realized PnL */}
      <p className={`text-sm font-medium text-right tabular-nums ${entry.realizedPnL !== 0 ? pnlColor(entry.realizedPnL) : "text-gray-300"}`}>
        {entry.realizedPnL !== 0 ? formatPnL(entry.realizedPnL) : "—"}
      </p>

      {/* Total PnL */}
      <p className={`text-sm font-bold text-right tabular-nums ${pnlColor(entry.totalPnL)}`}>
        {formatPnL(entry.totalPnL)}
      </p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PnLTracker() {
  const { stxAddress, isConnected } = useWalletStore();
  const [data, setData] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !stxAddress) {
      queueMicrotask(() => {
        setData(null);
        setError(null);
      });
      return;
    }
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setLoading(true);
          setError(null);
        }
        return getPnLData(stxAddress);
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setError("Failed to load PnL data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [stxAddress, isConnected]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-700">PnL Tracker</h2>
          {!loading && data && (
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg font-medium">
              {data.entries.length} assets
            </span>
          )}
        </div>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            Calculating...
          </span>
        )}
      </div>

      {/* States */}
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <BarChart3 size={36} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Connect your wallet to view PnL</p>
        </div>
      ) : loading ? (
        <SkeletonLoader />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <BarChart3 size={32} className="text-gray-200 mb-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <BarChart3 size={32} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No PnL data available</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const totalCost = data.entries.reduce((s, e) => s + e.totalCost, 0);
              return (
                <SummaryCard
                  label="Unrealized PnL"
                  value={data.totalUnrealized}
                  pct={totalCost > 0 ? (data.totalUnrealized / totalCost) * 100 : undefined}
                />
              );
            })()}
            <SummaryCard label="Realized PnL" value={data.totalRealized} />
            <SummaryCard label="Total PnL" value={data.totalPnL} />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <span>Token</span>
              <span className="text-right">Avg Cost</span>
              <span className="text-right">Cur. Price</span>
              <span className="text-right">Unrealized</span>
              <span className="text-right">Realized</span>
              <span className="text-right">Total PnL</span>
            </div>
            <div>
              {data.entries.map((entry) => (
                <PnLRow key={entry.contractId || "stx"} entry={entry} />
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
            <Info size={11} className="text-gray-300 flex-shrink-0" />
            <p className="text-xs text-gray-400">
              Based on on-chain history (max 1,000 txs). Results may be approximate.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
