"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { ArrowUpRight, ArrowDownLeft, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, Download, Wallet } from "lucide-react";
import { downloadCSV, csvDate } from "@/lib/export";
import { TokenWithValue } from "@/lib/stacks";
import { formatUSD } from "@/lib/utils";
import SendModal, { SendTokenInfo } from "@/components/wallet/SendModal";
import ReceiveModal from "@/components/wallet/ReceiveModal";
import EmptyState from "@/components/motion/EmptyState";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";
import Sparkline from "@/components/dashboard/Sparkline";
import TokenDetailDrawer from "@/components/assets/drawer";

/** Convert a human-readable balance to its raw on-chain integer string.
 * Avoids `balance * 10**decimals` which loses precision at high decimals +
 * large values (e.g. 8-decimal token with balance > ~90M). Uses toFixed +
 * string ops so the result is exact up to whatever precision the upstream
 * balance float already carried. */
function humanBalanceToRaw(balance: number, decimals: number): string {
  if (!Number.isFinite(balance) || balance <= 0) return "0";
  const fixed = balance.toFixed(decimals);
  const [whole, frac = ""] = fixed.split(".");
  const joined = (whole + frac.padEnd(decimals, "0")).replace(/^0+(?=\d)/, "");
  return joined || "0";
}

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
      <div className={`w-9 h-9 rounded-full overflow-hidden bg-gray-50 shrink-0 ${ring}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUri} alt={symbol} className="w-full h-full object-cover" onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div className={`w-9 h-9 rounded-full bg-[#B0E4CC]/20 flex items-center justify-center shrink-0 ${ring}`}>
      <span className="text-xs font-bold text-[#285A48]">{symbol.slice(0, 3)}</span>
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
        className="flex items-center gap-0.5 text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full cursor-help shrink-0"
      >
        <ShieldAlert size={9} />
        Suspicious
      </span>
    );
  }

  return (
    <span
      title="This token is not listed in any known price feed. It may be legitimate but unverified. Exercise caution."
      className="flex items-center gap-0.5 text-[10px] font-semibold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full cursor-help shrink-0"
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
        ? <ShieldAlert size={14} className="text-red-500 shrink-0 mt-0.5" />
        : <AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
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
  onSelect: (t: TokenWithValue) => void;
}

const TokenRow = memo(function TokenRow({ t, totalUsd, onSend, onReceive, onSelect }: TokenRowProps) {
  const pct = totalUsd > 0 ? (t.valueUsd / totalUsd) * 100 : 0;
  const isPositive = (t.change24h ?? 0) >= 0;
  const isFlagged = !!t.warning;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(t)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(t);
        }
      }}
      className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[2fr_1fr_1fr_60px_1fr_80px] gap-3 md:gap-4 px-3 md:px-6 py-3.5 transition-colors group items-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#408A71]/50"
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = isFlagged ? 'var(--bg-elevated)' : 'transparent')}
      style={isFlagged ? { backgroundColor: 'var(--bg-elevated)' } : undefined}
    >
      {/* Token info */}
      <div className="flex items-center gap-2.5 min-w-0">
        <TokenAvatar symbol={t.symbol} imageUri={t.imageUri} warning={t.warning} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: isFlagged ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {t.symbol}
            </p>
            <WarningBadge warning={t.warning} />
          </div>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t.name}</p>
        </div>
        {/* Portfolio % bar — desktop xl only */}
        {!isFlagged && (
          <div className="hidden xl:flex items-center gap-1.5 ml-2">
            <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#B0E4CC] rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-[10px] text-gray-400">{pct.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Balance — desktop only */}
      <p className="hidden md:block text-sm text-right font-medium" style={{ color: isFlagged ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
        {formatBalance(t.balance)}
      </p>

      {/* Price — desktop only */}
      <p className="hidden md:block text-sm text-right" style={{ color: isFlagged ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
        {formatPrice(t.priceUsd)}
      </p>

      {/* Sparkline — desktop only */}
      <div className="hidden md:flex justify-center">
        {!isFlagged && <Sparkline change24h={t.change24h} />}
      </div>

      {/* Value */}
      <p className="text-sm font-semibold text-right" style={{ color: isFlagged ? 'var(--text-muted)' : 'var(--text-primary)' }}>
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
            onClick={(e) => {
              e.stopPropagation();
              onSend(t);
            }}
            title="Send"
            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
          >
            <ArrowUpRight size={11} className="text-red-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReceive();
            }}
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
  const [selectedToken, setSelectedToken] = useState<TokenWithValue | null>(null);

  const allTokens = useMemo(() => stx ? [stx, ...tokens] : tokens, [stx, tokens]);
  const trustedTokens = useMemo(() => allTokens.filter((t) => !t.warning), [allTokens]);
  const flaggedTokens = useMemo(() => allTokens.filter((t) => t.warning), [allTokens]);
  const suspiciousCount = useMemo(() => flaggedTokens.filter((t) => t.warning === "suspicious").length, [flaggedTokens]);
  const unverifiedCount = useMemo(() => flaggedTokens.filter((t) => t.warning === "unverified").length, [flaggedTokens]);

  const onSend = useCallback((t: TokenWithValue) =>
    setSendToken({
      symbol: t.symbol,
      name: t.name,
      rawBalance: humanBalanceToRaw(t.balance, t.decimals),
      decimals: t.decimals,
      contractId: t.contractId,
      imageUri: t.imageUri,
    }), []);

  const onReceive = useCallback(() => setReceiveOpen(true), []);

  const onSelect = useCallback((t: TokenWithValue) => setSelectedToken(t), []);
  const onCloseDrawer = useCallback(() => setSelectedToken(null), []);

  // The drawer reuses the existing send/receive flows. When the user triggers
  // them from inside the drawer, close it first so the modal owns the screen.
  const onSendFromDrawer = useCallback(
    (t: TokenWithValue) => {
      setSelectedToken(null);
      onSend(t);
    },
    [onSend]
  );
  const onReceiveFromDrawer = useCallback(() => {
    setSelectedToken(null);
    setReceiveOpen(true);
  }, []);

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
      <div className="glass-card rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Token Holdings</h2>
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
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#285A48] bg-gray-50 hover:bg-[#B0E4CC]/20 px-2 py-1 rounded-lg transition-colors"
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
        <div className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[2fr_1fr_1fr_60px_1fr_80px] gap-3 md:gap-4 px-3 md:px-6 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
          <span>Token</span>
          <span className="hidden md:block text-right">Balance</span>
          <span className="hidden md:block text-right">Price</span>
          <span className="hidden md:block text-center">7d</span>
          <span className="text-right">Value</span>
          <span className="text-right">24h</span>
        </div>

        {/* Rows */}
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {loading ? (
            [...Array(5)].map((_, i) => {
              const sk = { backgroundColor: 'var(--border-subtle)' } as const;
              return (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[2fr_1fr_1fr_60px_1fr_80px] gap-3 md:gap-4 px-3 md:px-6 py-3.5 animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full shrink-0" style={sk} />
                    <div className="space-y-1.5">
                      <div className="h-3 rounded w-16" style={sk} />
                      <div className="h-3 rounded w-10" style={sk} />
                    </div>
                  </div>
                  <div className="hidden md:block h-3 rounded w-20 ml-auto self-center" style={sk} />
                  <div className="hidden md:block h-3 rounded w-16 ml-auto self-center" style={sk} />
                  <div className="hidden md:block h-3 rounded w-14 mx-auto self-center" style={sk} />
                  <div className="h-3 rounded w-16 ml-auto self-center" style={sk} />
                  <div className="h-3 rounded w-10 ml-auto self-center" style={sk} />
                </div>
              );
            })
          ) : allTokens.length === 0 ? (
            <EmptyState
              icon={<Wallet size={28} style={{ color: 'var(--accent)' }} />}
              title="No tokens found"
              description="Connect your wallet or fund it with STX to see your token holdings here."
              action={<ConnectWalletCTA />}
            />
          ) : (
            <>
              {/* Trusted tokens */}
              {trustedTokens.map((t) => <TokenRow key={t.contractId || "stx"} t={t} totalUsd={totalUsd} onSend={onSend} onReceive={onReceive} onSelect={onSelect} />)}

              {/* Flagged tokens — collapsible */}
              {flaggedTokens.length > 0 && (
                <>
                  <button
                    onClick={() => setShowFlagged((v) => !v)}
                    className="w-full flex items-center justify-between px-6 py-3 transition-colors text-left"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--border-subtle)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)')}
                  >
                    <span className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                      <ShieldAlert size={13} className="text-red-400" />
                      {flaggedTokens.length} flagged token{flaggedTokens.length > 1 ? "s" : ""} (spam / unverified)
                    </span>
                    {showFlagged ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </button>
                  {showFlagged && flaggedTokens.map((t) => <TokenRow key={t.contractId} t={t} totalUsd={totalUsd} onSend={onSend} onReceive={onReceive} onSelect={onSelect} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {sendToken && <SendModal token={sendToken} onClose={() => setSendToken(null)} />}
      {receiveOpen && <ReceiveModal onClose={() => setReceiveOpen(false)} />}
      <TokenDetailDrawer
        token={selectedToken}
        totalUsd={totalUsd}
        onClose={onCloseDrawer}
        onSend={onSendFromDrawer}
        onReceive={onReceiveFromDrawer}
      />
    </>
  );
}
