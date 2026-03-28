"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { ArrowUpRight, ArrowDownLeft, Coins, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, Download } from "lucide-react";
import { downloadCSV, csvDate } from "@/lib/export";
import { TokenWithValue } from "@/lib/stacks";
import { formatUSD } from "@/lib/utils";
import SendModal, { SendTokenInfo } from "@/components/wallet/SendModal";
import ReceiveModal from "@/components/wallet/ReceiveModal";

function formatBalance(n: number): string {
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function formatPrice(n: number): string {
  if (n === 0) return "—";
  if (n >= 1000) return formatUSD(n);
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

function TokenAvatar({ symbol, imageUri, warning }: { symbol: string; imageUri?: string; warning?: TokenWithValue["warning"] }) {
  const [err, setErr] = useState(false);

  const ring =
    warning === "suspicious"
      ? "ring-2 ring-red-300"
      : warning === "unverified"
      ? "ring-2 ring-yellow-300"
      : "";

  if (imageUri && !err) {
    return (
      <div className={`w-9 h-9 rounded-full overflow-hidden bg-gray-50 flex-shrink-0 ${ring}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUri} alt={symbol} className="w-full h-full object-cover" onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div className={`w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0 ${ring}`}>
      <span className="text-xs font-bold text-teal-600">{symbol.slice(0, 3)}</span>
    </div>
  );
}

// Warning badge shown next to token name
function WarningBadge({ warning }: { warning: TokenWithValue["warning"] }) {
  if (!warning) return null;

  if (warning === "suspicious") {
    return (
      <span
        title="This token has no registered metadata. It may be a spam airdrop or scam token. Do not interact unless you trust the source."
        className="flex items-center gap-0.5 text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full cursor-help flex-shrink-0"
      >
        <ShieldAlert size={9} />
        Suspicious
      </span>
    );
  }

  return (
    <span
      title="This token is not listed in any known price feed. It may be legitimate but unverified. Exercise caution."
      className="flex items-center gap-0.5 text-[10px] font-semibold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full cursor-help flex-shrink-0"
    >
      <AlertTriangle size={9} />
      Unverified
    </span>
  );
}

// Warning banner shown at the top when flagged tokens exist
function WarningBanner({ suspicious, unverified }: { suspicious: number; unverified: number }) {
  if (suspicious === 0 && unverified === 0) return null;

  const hasSuspicious = suspicious > 0;

  return (
    <div className={`flex items-start gap-2.5 px-3 md:px-6 py-3 border-b ${hasSuspicious ? "bg-red-50 border-red-100" : "bg-yellow-50 border-yellow-100"}`}>
      {hasSuspicious
        ? <ShieldAlert size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
        : <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />
      }
      <p className={`text-xs leading-relaxed ${hasSuspicious ? "text-red-700" : "text-yellow-700"}`}>
        {hasSuspicious && (
          <>
            <span className="font-semibold">{suspicious} suspicious token{suspicious > 1 ? "s" : ""}</span> detected — likely spam airdrops with no registered metadata.{" "}
          </>
        )}
        {unverified > 0 && (
          <>
            <span className="font-semibold">{unverified} unverified token{unverified > 1 ? "s" : ""}</span> found with no price data.{" "}
          </>
        )}
        Do not interact with unknown tokens unless you trust the source.
      </p>
    </div>
  );
}

interface TokenRowProps {
  t: TokenWithValue;
  totalUsd: number;
  onSend: (t: TokenWithValue) => void;
  onReceive: () => void;
}

const TokenRow = memo(function TokenRow({ t, totalUsd, onSend, onReceive }: TokenRowProps) {
  const pct = totalUsd > 0 ? (t.valueUsd / totalUsd) * 100 : 0;
  const isPositive = (t.change24h ?? 0) >= 0;
  const isFlagged = !!t.warning;

  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto] md:grid-cols-[2fr_1fr_1fr_1fr_80px] gap-3 md:gap-4 px-3 md:px-6 py-3.5 transition-colors group items-center ${
        isFlagged ? "bg-gray-50/50 hover:bg-gray-50" : "hover:bg-gray-50"
      }`}
    >
      {/* Token info */}
      <div className="flex items-center gap-2.5 min-w-0">
        <TokenAvatar symbol={t.symbol} imageUri={t.imageUri} warning={t.warning} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`text-sm font-semibold ${isFlagged ? "text-gray-500" : "text-gray-900"}`}>
              {t.symbol}
            </p>
            <WarningBadge warning={t.warning} />
          </div>
          <p className="text-xs text-gray-400 truncate">{t.name}</p>
        </div>
        {/* Portfolio % bar — desktop xl only */}
        {!isFlagged && (
          <div className="hidden xl:flex items-center gap-1.5 ml-2">
            <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-teal-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-[10px] text-gray-400">{pct.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Balance — desktop only */}
      <p className={`hidden md:block text-sm text-right font-medium ${isFlagged ? "text-gray-400" : "text-gray-700"}`}>
        {formatBalance(t.balance)}
      </p>

      {/* Price — desktop only */}
      <p className={`hidden md:block text-sm text-right ${isFlagged ? "text-gray-400" : "text-gray-700"}`}>
        {formatPrice(t.priceUsd)}
      </p>

      {/* Value */}
      <p className={`text-sm font-semibold text-right ${isFlagged ? "text-gray-400" : "text-gray-900"}`}>
        {t.valueUsd > 0 ? formatUSD(t.valueUsd) : "—"}
      </p>

      {/* 24h + actions */}
      <div className="flex items-center justify-end gap-1.5">
        {t.change24h !== null ? (
          <span className={`text-xs font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
            {isPositive ? "+" : ""}
            {t.change24h.toFixed(2)}%
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}

        <div className="hidden md:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onSend(t)}
            title="Send"
            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
          >
            <ArrowUpRight size={11} className="text-red-500" />
          </button>
          <button
            onClick={onReceive}
            title="Receive"
            className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
          >
            <ArrowDownLeft size={11} className="text-green-500" />
          </button>
        </div>
      </div>
    </div>
  );
});

interface Props {
  stx: TokenWithValue | null;
  tokens: TokenWithValue[];
  totalUsd: number;
  loading: boolean;
}

export default function TokenHoldings({ stx, tokens, totalUsd, loading }: Props) {
  const [sendToken, setSendToken] = useState<SendTokenInfo | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [showFlagged, setShowFlagged] = useState(false);

  const allTokens = useMemo(() => stx ? [stx, ...tokens] : tokens, [stx, tokens]);
  const trustedTokens = useMemo(() => allTokens.filter((t) => !t.warning), [allTokens]);
  const flaggedTokens = useMemo(() => allTokens.filter((t) => t.warning), [allTokens]);
  const suspiciousCount = useMemo(() => flaggedTokens.filter((t) => t.warning === "suspicious").length, [flaggedTokens]);
  const unverifiedCount = useMemo(() => flaggedTokens.filter((t) => t.warning === "unverified").length, [flaggedTokens]);

  const onSend = useCallback((t: TokenWithValue) =>
    setSendToken({
      symbol: t.symbol,
      name: t.name,
      rawBalance: String(Math.round(t.balance * Math.pow(10, t.decimals))),
      decimals: t.decimals,
      contractId: t.contractId,
      imageUri: t.imageUri,
    }), []);

  const onReceive = useCallback(() => setReceiveOpen(true), []);

  const handleExport = useCallback(() => {
    const headers = ["Symbol", "Name", "Balance", "Price (USD)", "Value (USD)", "24h Change (%)"];
    const rows = allTokens.map((t) => [
      t.symbol,
      t.name,
      t.balance,
      t.priceUsd,
      t.valueUsd,
      t.change24h ?? "",
    ]);
    downloadCSV(`token-holdings-${csvDate()}.csv`, [headers, ...rows]);
  }, [allTokens]);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-700">Token Holdings</h2>
          {!loading && (
            <div className="flex items-center gap-2">
              {flaggedTokens.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                  <ShieldAlert size={11} />
                  {flaggedTokens.length} flagged
                </span>
              )}
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                {allTokens.length} assets
              </span>
              {allTokens.length > 0 && (
                <button
                  onClick={handleExport}
                  title="Export CSV"
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 px-2 py-1 rounded-lg transition-colors"
                >
                  <Download size={11} />
                  Export
                </button>
              )}
            </div>
          )}
        </div>

        {/* Warning banner */}
        {!loading && (suspiciousCount > 0 || unverifiedCount > 0) && (
          <WarningBanner suspicious={suspiciousCount} unverified={unverifiedCount} />
        )}

        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[2fr_1fr_1fr_1fr_80px] gap-3 md:gap-4 px-3 md:px-6 py-2.5 bg-gray-50 text-xs font-medium text-gray-400 uppercase tracking-wide">
          <span>Token</span>
          <span className="hidden md:block text-right">Balance</span>
          <span className="hidden md:block text-right">Price</span>
          <span className="text-right">Value</span>
          <span className="text-right">24h</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-50">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[2fr_1fr_1fr_1fr_80px] gap-3 md:gap-4 px-3 md:px-6 py-3.5 animate-pulse">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-16" />
                    <div className="h-3 bg-gray-100 rounded w-10" />
                  </div>
                </div>
                <div className="hidden md:block h-3 bg-gray-100 rounded w-20 ml-auto self-center" />
                <div className="hidden md:block h-3 bg-gray-100 rounded w-16 ml-auto self-center" />
                <div className="h-3 bg-gray-100 rounded w-16 ml-auto self-center" />
                <div className="h-3 bg-gray-100 rounded w-10 ml-auto self-center" />
              </div>
            ))
          ) : allTokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Coins size={32} className="text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No tokens found</p>
            </div>
          ) : (
            <>
              {/* Trusted tokens */}
              {trustedTokens.map((t) => <TokenRow key={t.contractId || "stx"} t={t} totalUsd={totalUsd} onSend={onSend} onReceive={onReceive} />)}

              {/* Flagged tokens — collapsible */}
              {flaggedTokens.length > 0 && (
                <>
                  <button
                    onClick={() => setShowFlagged((v) => !v)}
                    className="w-full flex items-center justify-between px-6 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium text-gray-500">
                      <ShieldAlert size={13} className="text-red-400" />
                      {flaggedTokens.length} flagged token{flaggedTokens.length > 1 ? "s" : ""} (spam / unverified)
                    </span>
                    {showFlagged ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </button>
                  {showFlagged && flaggedTokens.map((t) => <TokenRow key={t.contractId} t={t} totalUsd={totalUsd} onSend={onSend} onReceive={onReceive} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {sendToken && <SendModal token={sendToken} onClose={() => setSendToken(null)} />}
      {receiveOpen && <ReceiveModal onClose={() => setReceiveOpen(false)} />}

    </>
  );
}
