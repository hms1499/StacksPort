"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowUpRight, ArrowDownLeft, Repeat, Bell, Copy, Check, TrendingUp, TrendingDown } from "lucide-react";
import { getGeckoIdForContract, type TokenWithValue } from "@/lib/stacks";
import TokenPnL from "./PnL";
import TokenYieldInfo from "./YieldInfo";
import { formatUSD } from "@/lib/utils";
import TokenPriceChart from "./PriceChart";
import TokenMarketStats24h from "./MarketStats";
import TokenTransactions from "./Transactions";
import InlineQuickSend from "./QuickSend";
import InlineQuickSwap from "./QuickSwap";
import AlertPopover from "./AlertPopover";
import { PRICE_ALERT_TOKENS } from "@/types/priceAlerts";
import { TokenImage } from "@/components/ui";

interface Props {
  token: TokenWithValue | null;
  totalUsd: number;
  onClose: () => void;
  onSend: (t: TokenWithValue) => void;
  onReceive: () => void;
}

function formatBalance(n: number): string {
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n >= 1) return n.toFixed(6);
  return n.toFixed(8);
}

function formatPrice(n: number): string {
  if (n === 0) return "—";
  if (n >= 1000) return formatUSD(n);
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

function truncateMiddle(s: string, head = 14, tail = 10): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export default function TokenDetailDrawer({ token, totalUsd, onClose, onSend, onReceive }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // ESC closes. Mounted only while a token is selected so we don't leak the
  // global listener when the drawer is closed.
  useEffect(() => {
    if (!token) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [token, onClose]);

  const [alertOpen, setAlertOpen] = useState(false);
  const alertBtnRef = useRef<HTMLButtonElement>(null);

  if (!token) return null;

  const pct = totalUsd > 0 ? (token.valueUsd / totalUsd) * 100 : 0;
  const change24h = token.change24h;
  const isPositive = (change24h ?? 0) >= 0;
  const isSTX = !token.contractId || token.contractId === "stx";
  const isAlertSupported = PRICE_ALERT_TOKENS.some((t) => t.symbol === token.symbol);
  const geckoId = getGeckoIdForContract(token.contractId);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(token.contractId || "STX");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; silently ignore — user can still read the id
    }
  };

  const onSwap = () => {
    // Pass contract id so /trade can preselect; STX uses the literal "stx"
    // marker that the swap widget already recognises.
    const from = isSTX ? "stx" : token.contractId;
    router.push(`/trade?from=${encodeURIComponent(from)}`);
    onClose();
  };

  const onAlert = () => {
    if (!isAlertSupported) return;
    setAlertOpen((o) => !o);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="token-drawer-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-sm transition-opacity"
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-md ml-auto h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        style={{ backgroundColor: "var(--bg-card)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <TokenImage src={token.imageUri} symbol={token.symbol} size={40} />
            <div className="min-w-0">
              <h2
                id="token-drawer-title"
                className="text-base font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {token.symbol}
              </h2>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {token.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Balance */}
        <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Your Balance
          </p>
          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {formatBalance(token.balance)} {token.symbol}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {token.valueUsd > 0 ? formatUSD(token.valueUsd) : "—"}
            </span>
            {pct > 0 && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                · {pct.toFixed(1)}% of portfolio
              </span>
            )}
          </div>
        </div>

        {/* PnL (cost basis, unrealized, realized) — only when an entry exists */}
        <TokenPnL token={token} isSTX={isSTX} />

        {/* Stacking / yield info for stSTX & sBTC */}
        <TokenYieldInfo token={token} />

        {/* Price + chart */}
        <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                Price
              </p>
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {formatPrice(token.priceUsd)}
              </p>
            </div>
            {change24h !== null && (
              <span
                className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}
              >
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isPositive ? "+" : ""}
                {change24h.toFixed(2)}%
                <span className="text-xs font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>
                  24h
                </span>
              </span>
            )}
          </div>
          {geckoId && (
            <div className="mt-4">
              <TokenPriceChart geckoId={geckoId} symbol={token.symbol} />
            </div>
          )}
          {geckoId && <TokenMarketStats24h geckoId={geckoId} />}
        </div>

        {/* Inline quick-swap (only for tokens with a route in the swap registry) */}
        <InlineQuickSwap token={token} isSTX={isSTX} onClose={onClose} />

        {/* Inline quick-send */}
        <InlineQuickSend token={token} isSTX={isSTX} />

        {/* Recent token activity */}
        <TokenTransactions
          token={token}
          isSTX={isSTX}
        />

        {/* Actions */}
        <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="grid grid-cols-4 gap-2">
            <ActionButton icon={<Repeat size={16} />} label="Swap" onClick={onSwap} />
            <ActionButton icon={<ArrowUpRight size={16} />} label="Send" onClick={() => onSend(token)} />
            <ActionButton icon={<ArrowDownLeft size={16} />} label="Receive" onClick={onReceive} />
            <ActionButton
              ref={alertBtnRef}
              icon={<Bell size={16} />}
              label="Alert"
              onClick={onAlert}
              disabled={!isAlertSupported}
              title={!isAlertSupported ? "Alerts available for STX, BTC, WELSH, ALEX, VELAR, stSTX" : undefined}
            />
          </div>
        </div>

        {/* Meta */}
        <div className="p-5 mt-auto">
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
            Token Details
          </p>
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt style={{ color: "var(--text-muted)" }}>Contract</dt>
              <dd className="flex items-center gap-1.5 font-mono" style={{ color: "var(--text-secondary)" }}>
                <span className="truncate" title={token.contractId}>
                  {truncateMiddle(token.contractId || "STX (native)")}
                </span>
                {token.contractId && (
                  <button
                    type="button"
                    onClick={onCopy}
                    className="p-1 rounded transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                    aria-label="Copy contract id"
                  >
                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  </button>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt style={{ color: "var(--text-muted)" }}>Decimals</dt>
              <dd className="font-mono" style={{ color: "var(--text-secondary)" }}>{token.decimals}</dd>
            </div>
            {token.warning && (
              <div className="flex items-center justify-between">
                <dt style={{ color: "var(--text-muted)" }}>Status</dt>
                <dd
                  className={`font-medium ${token.warning === "suspicious" ? "text-red-500" : "text-yellow-600"}`}
                >
                  {token.warning === "suspicious" ? "Suspicious" : "Unverified"}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {isAlertSupported && (
          <AlertPopover
            token={token}
            currentPrice={token.priceUsd}
            open={alertOpen}
            onClose={() => setAlertOpen(false)}
            anchorRef={alertBtnRef}
          />
        )}
      </div>
    </div>
  );
}


const ActionButton = forwardRef<
  HTMLButtonElement,
  {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
  }
>(function ActionButton({ icon, label, onClick, disabled, title }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
      onMouseEnter={(e) => {
        if (!(e.currentTarget as HTMLButtonElement).disabled) {
          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)";
        }
      }}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)")}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
});
