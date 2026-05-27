"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowUpRight, ArrowDownLeft, Repeat, Bell, Copy, Check, TrendingUp, TrendingDown } from "lucide-react";
import { getGeckoIdForContract, type TokenWithValue } from "@/lib/stacks";
import TokenPnL from "./drawer/PnL";
import TokenYieldInfo from "./drawer/YieldInfo";
import { formatUSD } from "@/lib/utils";
import TokenPriceChart from "./drawer/PriceChart";
import TokenMarketStats24h from "./drawer/MarketStats";
import TokenTransactions from "./drawer/Transactions";
import InlineQuickSend from "./drawer/QuickSend";
import {
  SWAP_TOKENS,
  getValidDestinations,
  getQuote,
  sanitizeAmountInput,
  type SwapToken,
} from "@/lib/direct-swap";

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

  if (!token) return null;

  const pct = totalUsd > 0 ? (token.valueUsd / totalUsd) * 100 : 0;
  const change24h = token.change24h;
  const isPositive = (change24h ?? 0) >= 0;
  const isSTX = !token.contractId || token.contractId === "stx";
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
    router.push(`/notifications?token=${encodeURIComponent(token.symbol)}`);
    onClose();
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
        className="w-full sm:max-w-md ml-auto h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        style={{ backgroundColor: "var(--bg-card)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {token.imageUri ? (
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={token.imageUri} alt={token.symbol} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#B0E4CC]/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[#285A48]">
                  {token.symbol.slice(0, 3)}
                </span>
              </div>
            )}
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
            <ActionButton icon={<Bell size={16} />} label="Alert" onClick={onAlert} />
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
      </div>
    </div>
  );
}



function resolveSwapFrom(
  token: TokenWithValue,
  isSTX: boolean
): SwapToken | null {
  if (isSTX) return SWAP_TOKENS.find((t) => t.id === "stx") ?? null;
  if (!token.contractId) return null;
  return SWAP_TOKENS.find((t) => t.contract === token.contractId) ?? null;
}

function formatOut(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n >= 1) return n.toFixed(6);
  if (n >= 0.0001) return n.toFixed(8);
  return n.toExponential(3);
}

function InlineQuickSwap({
  token,
  isSTX,
  onClose,
}: {
  token: TokenWithValue;
  isSTX: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fromToken = resolveSwapFrom(token, isSTX);
  const dests = useMemo(
    () => (fromToken ? getValidDestinations(fromToken.id) : []),
    [fromToken]
  );
  const [toId, setToId] = useState<string>(dests[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [quoteOut, setQuoteOut] = useState<number | null>(null);
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep toId in sync if the swap pair changes (e.g. user opens a different token)
  useEffect(() => {
    if (dests.length === 0) {
      setToId("");
    } else if (!dests.some((d) => d.id === toId)) {
      setToId(dests[0].id);
    }
  }, [dests, toId]);

  // Debounced quote fetch
  useEffect(() => {
    setError(null);
    const n = Number(amount);
    if (!fromToken || !toId || !Number.isFinite(n) || n <= 0) {
      setQuoteOut(null);
      setPriceImpact(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const id = setTimeout(async () => {
      try {
        const q = await getQuote(fromToken.id, toId, n);
        if (cancelled) return;
        setQuoteOut(q.amountOutHuman);
        setPriceImpact(q.priceImpact);
      } catch (e) {
        if (cancelled) return;
        setQuoteOut(null);
        setPriceImpact(null);
        setError(e instanceof Error ? e.message : "Quote unavailable");
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [amount, fromToken, toId]);

  if (!fromToken || dests.length === 0) return null;

  const toToken = dests.find((d) => d.id === toId) ?? dests[0];
  const balance = token.balance;
  const overBalance = Number(amount) > balance;

  const onMax = () => {
    setAmount(sanitizeAmountInput(String(balance), fromToken.decimals));
  };

  const onContinue = () => {
    const q = new URLSearchParams({ from: fromToken.id, to: toId });
    if (amount) q.set("amount", amount);
    router.push(`/trade?${q.toString()}`);
    onClose();
  };

  const canContinue =
    !!amount && Number(amount) > 0 && !overBalance && quoteOut != null;

  return (
    <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-xs uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Quick Swap
        </p>
        <div className="flex gap-1">
          {dests.map((d) => {
            const active = d.id === toId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setToId(d.id)}
                className="text-[11px] font-semibold px-2 py-1 rounded-md transition-colors"
                style={{
                  backgroundColor: active ? "var(--accent)" : "var(--bg-elevated)",
                  color: active ? "#0A1628" : "var(--text-muted)",
                }}
                aria-pressed={active}
              >
                {d.symbol}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-xl p-3 flex items-center gap-2"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) =>
            setAmount(sanitizeAmountInput(e.target.value, fromToken.decimals))
          }
          placeholder="0.0"
          className="flex-1 bg-transparent outline-none text-base font-mono"
          style={{ color: "var(--text-primary)" }}
          aria-label={`Amount in ${fromToken.symbol}`}
        />
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {fromToken.symbol}
        </span>
        <button
          type="button"
          onClick={onMax}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors"
          style={{
            backgroundColor: "var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          MAX
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 min-h-[18px] text-xs">
        <span style={{ color: "var(--text-muted)" }}>
          Balance: {formatBalance(balance)} {fromToken.symbol}
        </span>
        {overBalance ? (
          <span className="text-red-500 font-medium">Exceeds balance</span>
        ) : quoting ? (
          <span style={{ color: "var(--text-muted)" }}>Quoting…</span>
        ) : quoteOut != null && toToken ? (
          <span style={{ color: "var(--text-secondary)" }}>
            ≈ {formatOut(quoteOut)} {toToken.symbol}
            {priceImpact != null && Math.abs(priceImpact) >= 0.5 && (
              <span
                className={priceImpact >= 5 ? "text-red-500 ml-1" : "ml-1"}
                style={priceImpact >= 5 ? undefined : { color: "var(--text-muted)" }}
              >
                ({priceImpact.toFixed(2)}%)
              </span>
            )}
          </span>
        ) : error ? (
          <span style={{ color: "var(--text-muted)" }}>{error}</span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--accent)",
          color: "#0A1628",
        }}
      >
        {amount && !overBalance ? `Continue to swap` : `Enter amount`}
      </button>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors"
      style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)")}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}
