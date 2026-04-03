"use client";

import React, { useState } from "react";
import { TrendingDown, TrendingUp, ExternalLink, Loader2, Zap } from "lucide-react";
import { connect as stacksConnect } from "@stacks/connect";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useWalletStore } from "@/store/walletStore";
import { useThemeStore } from "@/store/themeStore";
import { usePortfolio, usePortfolioHistory, useSTXPriceHistory } from "@/hooks/useMarketData";
import { formatUSD, formatSTX, formatPercent } from "@/lib/utils";
import AnimatedCounter from "@/components/motion/AnimatedCounter";

type Period = "1D" | "1W" | "1M";

const periodDays: Record<Period, number> = { "1D": 1, "1W": 7, "1M": 30 };

function BalanceCard() {
  const { stxAddress, isConnected, connect } = useWalletStore();
  const isDark = useThemeStore((s) => s.theme === "dark");
  const [period, setPeriod] = useState<Period>("1W");
  const [connecting, setConnecting] = useState(false);

  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio(addr);
  const { data: portfolioHistory } = usePortfolioHistory(
    addr,
    portfolio,
    periodDays[period]
  );
  const { data: priceHistory } = useSTXPriceHistory(
    periodDays[period],
    !isConnected
  );

  const chartData = isConnected ? portfolioHistory ?? [] : priceHistory ?? [];
  const loading = portfolioLoading && !portfolio;

  async function handleConnect() {
    setConnecting(true);
    try {
      const result = await stacksConnect();
      const stxEntry = result.addresses.find(
        (a) => a.symbol === "STX" || a.address.startsWith("SP") || a.address.startsWith("ST")
      );
      const btcEntry = result.addresses.find(
        (a) => a.symbol === "BTC" || (!a.address.startsWith("SP") && !a.address.startsWith("ST"))
      );
      connect(stxEntry?.address ?? result.addresses[0]?.address ?? "", btcEntry?.address ?? "");
    } catch {
      // user cancelled
    } finally {
      setConnecting(false);
    }
  }

  const isPositive = (portfolio?.stxChange24h ?? 0) >= 0;

  return (
    <div
      className="rounded-2xl p-5 overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
          >
            Portfolio Value
          </span>
          {isConnected && (
            <a
              href={`https://explorer.hiro.so/address/${stxAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Period selector */}
        <div
          className="flex gap-0.5 p-0.5 rounded-lg"
          style={{ backgroundColor: 'var(--border-subtle)' }}
        >
          {(["1D", "1W", "1M"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-150"
              style={
                period === p
                  ? { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }
                  : { color: 'var(--text-muted)' }
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Balance display ── */}
      <div className="mb-5">
        {loading ? (
          <div className="space-y-2">
            <div
              className="h-11 rounded-lg animate-pulse w-52"
              style={{ backgroundColor: 'var(--border-subtle)' }}
            />
            <div
              className="h-4 rounded-lg animate-pulse w-64"
              style={{ backgroundColor: 'var(--border-subtle)' }}
            />
          </div>
        ) : isConnected && portfolio ? (
          <>
            <div className="flex items-baseline gap-3">
              <AnimatedCounter
                value={portfolio.totalUSD}
                formatFn={formatUSD}
                className="text-4xl font-bold font-data"
              />
              <span
                className="flex items-center gap-1 text-sm font-semibold font-data px-2 py-0.5 rounded-lg"
                style={
                  isPositive
                    ? { color: 'var(--positive)', backgroundColor: isDark ? 'rgba(0, 229, 160, 0.1)' : 'rgba(0, 194, 122, 0.1)' }
                    : { color: 'var(--negative)', backgroundColor: isDark ? 'rgba(255, 91, 110, 0.1)' : 'rgba(240, 74, 110, 0.1)' }
                }
              >
                {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {formatPercent(portfolio.stxChange24h)}
              </span>
            </div>
            <div
              className="flex items-center gap-2 text-xs mt-1.5 font-data flex-wrap"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>{formatSTX(portfolio.stxBalance)} STX</span>
              <span style={{ color: 'var(--border-default)' }}>·</span>
              <span style={{ color: 'var(--text-secondary)' }}>${portfolio.stxPrice.toFixed(4)}/STX</span>
              {portfolio.otherUSD > 0 && (
                <>
                  <span style={{ color: 'var(--border-default)' }}>·</span>
                  <span>+{formatUSD(portfolio.otherUSD)} other</span>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <p
              className="text-3xl font-bold font-data"
              style={{ color: 'var(--border-default)', letterSpacing: '-0.04em' }}
            >
              ——.——
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 self-start px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#060C18',
                boxShadow: connecting ? 'none' : '0 0 14px var(--accent-glow)',
              }}
            >
              {connecting
                ? <Loader2 size={14} className="animate-spin" />
                : <Zap size={14} fill="currentColor" />
              }
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={isDark ? "#00E5A0" : "#00C27A"} stopOpacity={0.25} />
                <stop offset="100%" stopColor={isDark ? "#00E5A0" : "#00C27A"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: isDark ? '#2A4060' : '#8AA0BE', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: isDark ? 'var(--bg-elevated)' : '#fff',
                border: `1px solid ${isDark ? 'var(--border-default)' : '#E2EAF4'}`,
                borderRadius: '12px',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: isDark ? '#DDE8F8' : '#0A1628',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              }}
              formatter={(v: unknown) => [
                isConnected ? formatUSD(Number(v)) : `$${Number(v).toFixed(4)}`,
                isConnected ? "Portfolio" : "STX Price",
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isDark ? "#00E5A0" : "#00C27A"}
              strokeWidth={1.5}
              fill="url(#balanceGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div
          className="h-[110px] rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--border-subtle)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading chart…</span>
        </div>
      )}
    </div>
  );
}

export default React.memo(BalanceCard);
