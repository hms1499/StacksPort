"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ExternalLink,
  Clock,
  Bitcoin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { getSBTCData, SBTCData, SBTCBridgeTx } from "@/lib/stacks";
import { formatUSD } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatBTC(n: number): string {
  if (n === 0) return "0 sBTC";
  if (n >= 1) return `${n.toFixed(6)} sBTC`;
  if (n >= 0.001) return `${n.toFixed(6)} sBTC`;
  return `${n.toFixed(8)} sBTC`;
}

function shortenAddr(addr?: string): string {
  if (!addr) return "—";
  if (addr.includes(".")) return addr.split(".")[1]?.slice(0, 20) ?? addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

// ─── Peg Status ───────────────────────────────────────────────────────────────

function PegStatusBar({ peg }: { peg: SBTCData["peg"] }) {
  const { btcPrice, sbtcPrice, deviation, status } = peg;

  const statusConfig = {
    pegged:   { label: "Pegged",          color: "text-green-500",  bg: "bg-green-50",  bar: "bg-green-400", Icon: CheckCircle2 },
    slight:   { label: "Slight Deviation",color: "text-yellow-500", bg: "bg-yellow-50", bar: "bg-yellow-400", Icon: AlertTriangle },
    depegged: { label: "Depeg Risk",      color: "text-red-500",    bg: "bg-red-50",    bar: "bg-red-400",    Icon: XCircle },
  }[status];

  const { Icon } = statusConfig;

  // Gauge: center = 0%, max visual = ±3%
  const MAX = 3;
  const clampedDev = Math.max(-MAX, Math.min(MAX, deviation));
  const isPositive = clampedDev >= 0;
  const fillPct = (Math.abs(clampedDev) / MAX) * 50; // 0–50% from center

  return (
    <div className={`rounded-xl p-4 ${statusConfig.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={15} className={statusConfig.color} />
          <span className={`text-xs font-semibold ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>
        <span className={`text-xs font-bold tabular-nums ${statusConfig.color}`}>
          {deviation >= 0 ? "+" : ""}{deviation.toFixed(3)}%
        </span>
      </div>

      {/* Price row */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2.5">
        <span>BTC <span className="font-semibold text-gray-700">${btcPrice.toLocaleString()}</span></span>
        <span>sBTC <span className="font-semibold text-gray-700">${sbtcPrice.toLocaleString()}</span></span>
      </div>

      {/* Deviation gauge */}
      <div className="relative h-1.5 bg-white/60 rounded-full overflow-hidden">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-gray-300 -translate-x-px z-10" />
        {/* Fill */}
        <div
          className={`absolute top-0 h-full rounded-full ${statusConfig.bar}`}
          style={{
            left: isPositive ? "50%" : `${50 - fillPct}%`,
            width: `${fillPct}%`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400">
        <span>-3%</span>
        <span>0%</span>
        <span>+3%</span>
      </div>
    </div>
  );
}

// ─── Bridge Tx Row ────────────────────────────────────────────────────────────

const TX_STYLES = {
  deposit: {
    Icon: ArrowDownLeft,
    iconBg: "bg-green-50",
    iconColor: "text-green-500",
    amountColor: "text-green-500",
    label: "Deposit",
    prefix: "+",
  },
  withdrawal: {
    Icon: ArrowUpRight,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    amountColor: "text-red-500",
    label: "Withdrawal",
    prefix: "−",
  },
  transfer: {
    Icon: ArrowLeftRight,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    amountColor: "text-gray-700",
    label: "Transfer",
    prefix: "",
  },
};

const STATUS_DOT: Record<SBTCBridgeTx["txStatus"], string> = {
  success: "bg-green-400",
  pending: "bg-yellow-400",
  failed:  "bg-red-400",
};

function BridgeTxRow({ tx }: { tx: SBTCBridgeTx }) {
  const style = TX_STYLES[tx.direction];
  const { Icon } = style;

  return (
    <a
      href={`https://explorer.hiro.so/txid/${tx.txId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors group"
    >
      <div className={`w-9 h-9 rounded-full ${style.iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={15} className={style.iconColor} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900">{style.label}</p>
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[tx.txStatus]} flex-shrink-0`} />
        </div>
        <p className="text-xs text-gray-400 truncate">
          {tx.fnName ? tx.fnName.replace(/-/g, " ") : shortenAddr(tx.counterpart)}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-semibold ${style.amountColor}`}>
          {style.prefix}{tx.amount.toFixed(6)} sBTC
        </p>
        <p className="text-xs text-gray-400 flex items-center justify-end gap-0.5 mt-0.5">
          <Clock size={9} />
          {tx.timestamp > 0 ? timeAgo(tx.timestamp) : "—"}
        </p>
      </div>

      <ExternalLink
        size={11}
        className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      />
    </a>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-16" />
            <div className="h-6 bg-gray-200 rounded w-28" />
            <div className="h-3 bg-gray-200 rounded w-20" />
          </div>
        ))}
      </div>
      <div className="h-24 bg-gray-50 rounded-xl" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <div className="w-9 h-9 rounded-full bg-gray-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-100 rounded w-24" />
              <div className="h-3 bg-gray-100 rounded w-32" />
            </div>
            <div className="h-3 bg-gray-100 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SBTCMonitor() {
  const { stxAddress, isConnected } = useWalletStore();
  const [data, setData] = useState<SBTCData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !stxAddress) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return getSBTCData(stxAddress);
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [stxAddress, isConnected]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
            <Bitcoin size={15} className="text-orange-500" />
          </div>
          <h2 className="font-semibold text-gray-700">sBTC Position</h2>
        </div>
        <a
          href="https://docs.stacks.co/concepts/sbtc"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-teal-500 hover:text-teal-600 transition-colors flex items-center gap-1"
        >
          About sBTC <ExternalLink size={11} />
        </a>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Bitcoin size={32} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Connect your wallet to view sBTC position</p>
        </div>
      ) : loading ? (
        <SkeletonLoader />
      ) : !data ? null : (
        <div className="space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Balance */}
            <div className="bg-orange-50 rounded-xl p-4">
              <p className="text-xs text-orange-400 font-medium mb-1">sBTC Balance</p>
              {data.balance > 0 ? (
                <>
                  <p className="text-base font-bold text-gray-900">{formatBTC(data.balance)}</p>
                  <p className="text-xs text-orange-400 mt-0.5">{formatUSD(data.valueUsd)}</p>
                </>
              ) : (
                <>
                  <p className="text-base font-bold text-gray-400">0 sBTC</p>
                  <p className="text-xs text-gray-300 mt-0.5">No position</p>
                </>
              )}
            </div>

            {/* BTC Price */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 font-medium mb-1">BTC Price</p>
              <p className="text-base font-bold text-gray-900">
                ${data.peg.btcPrice.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Reference</p>
            </div>

            {/* sBTC Price */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 font-medium mb-1">sBTC Price</p>
              <p className="text-base font-bold text-gray-900">
                ${data.peg.sbtcPrice.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">CoinGecko</p>
            </div>
          </div>

          {/* Peg status */}
          <PegStatusBar peg={data.peg} />

          {/* No sBTC hint */}
          {data.balance === 0 && (
            <div className="text-center py-2">
              <p className="text-xs text-gray-400">
                You don&apos;t hold any sBTC yet.{" "}
                <a
                  href="https://app.stacks.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-500 hover:underline"
                >
                  Bridge BTC → sBTC
                </a>
              </p>
            </div>
          )}

          {/* Bridge History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Bridge History</p>
              {data.bridgeHistory.length > 0 && (
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                  {data.bridgeHistory.length} transactions
                </span>
              )}
            </div>

            {data.bridgeHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center bg-gray-50 rounded-xl">
                <ArrowLeftRight size={24} className="text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">No sBTC bridge transactions found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.bridgeHistory.slice(0, 8).map((tx, i) => (
                  <BridgeTxRow key={`${tx.txId}-${i}`} tx={tx} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
