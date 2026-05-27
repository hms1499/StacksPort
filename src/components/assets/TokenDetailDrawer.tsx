"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowUpRight, ArrowDownLeft, Repeat, Bell, Copy, Check, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { getGeckoIdForContract, type TokenWithValue } from "@/lib/stacks";
import { useTokenPriceHistory } from "@/hooks/useMarketData";
import { useThemeStore } from "@/store/themeStore";
import { formatUSD } from "@/lib/utils";

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
        </div>

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

function TokenPriceChart({ geckoId, symbol }: { geckoId: string; symbol: string }) {
  const isDark = useThemeStore((s) => s.theme === "dark");
  const { data, isLoading } = useTokenPriceHistory(geckoId, 7);

  const { chartData, isPositive, color } = useMemo(() => {
    const rows = (data ?? []).map((p) => ({
      t: p.t,
      price: p.price,
      label: new Date(p.t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
    const up = rows.length >= 2 ? rows[rows.length - 1].price >= rows[0].price : true;
    const c = up ? (isDark ? "#00E5A0" : "#00C27A") : isDark ? "#F87171" : "#EF4444";
    return { chartData: rows, isPositive: up, color: c };
  }, [data, isDark]);

  if (!data && isLoading) {
    return (
      <div
        className="h-32 rounded-xl animate-pulse"
        style={{ backgroundColor: "var(--border-subtle)" }}
        aria-hidden
      />
    );
  }

  if (chartData.length < 2) {
    return (
      <div
        className="h-32 rounded-xl flex items-center justify-center text-xs"
        style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}
      >
        Price history unavailable
      </div>
    );
  }

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`tokGrad-${geckoId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: isDark ? "var(--bg-elevated)" : "#fff",
              border: `1px solid ${isDark ? "var(--border-default)" : "#E2EAF4"}`,
              borderRadius: "10px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: isDark ? "#DDE8F8" : "#0A1628",
              boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
            }}
            formatter={(v: unknown) => [`$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 6 })}`, symbol]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#tokGrad-${geckoId})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: color }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p
        className="text-[10px] mt-1 text-right"
        style={{ color: "var(--text-muted)" }}
      >
        7d · {isPositive ? "▲" : "▼"} via CoinGecko
      </p>
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
