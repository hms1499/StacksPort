"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { TrendingDown, TrendingUp, ExternalLink, Loader2, Zap, ChevronDown } from "lucide-react";
import PortfolioBreakdown from "@/components/dashboard/PortfolioBreakdown";
import { connect as stacksConnect } from "@stacks/connect";
import { useWalletStore } from "@/store/walletStore";
import { useThemeStore } from "@/store/themeStore";
import { usePortfolio, usePortfolioHistory, useSTXPriceHistory, useUserDCAPlans } from "@/hooks/useMarketData";
import { useFlashOnChange } from "@/hooks/useFlashOnChange";
import { formatUSD, formatSTX, formatPercent } from "@/lib/utils";
import AnimatedCounter from "@/components/motion/AnimatedCounter";

type Period = "1D" | "1W" | "1M" | "1Y";

const periodDays: Record<Period, number> = { "1D": 1, "1W": 7, "1M": 30, "1Y": 365 };

const ChartPlaceholder = () => (
  <div className="h-full min-h-[110px] rounded-xl flex items-center justify-center bg-sunken">
    <span className="text-xs text-fg-muted">Loading chart…</span>
  </div>
);

// Recharts is heavy; defer it to its own chunk so it doesn't bloat the eager
// dashboard render path. ssr:false because the chart is purely decorative.
const BalanceCardChart = dynamic(() => import("./BalanceCardChart"), {
  ssr: false,
  loading: ChartPlaceholder,
});

function BalanceCard() {
  const { stxAddress, isConnected, connect } = useWalletStore();
  const isDark = useThemeStore((s) => s.theme === "dark");
  const [period, setPeriod] = useState<Period>("1W");
  const [connecting, setConnecting] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Dismiss breakdown on Escape or click outside the card
  useEffect(() => {
    if (!breakdownOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setBreakdownOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setBreakdownOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [breakdownOpen]);

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
  const { data: dcaPlans } = useUserDCAPlans(addr);

  const dcaUsdLocked = useMemo(() => {
    if (!portfolio || !dcaPlans?.length) return 0;
    const totalStx = dcaPlans.reduce((sum, p) => sum + p.bal / 1_000_000, 0);
    return totalStx * portfolio.stxPrice;
  }, [dcaPlans, portfolio]);

  const chartData = isConnected ? portfolioHistory ?? [] : priceHistory ?? [];
  const loading = portfolioLoading && !portfolio;

  const periodChange = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    if (first === 0) return null;
    return ((last - first) / first) * 100;
  }, [chartData]);

  const periodChangeUSD = useMemo(() => {
    if (!isConnected || chartData.length < 2) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    return last - first;
  }, [chartData, isConnected]);

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

  const isPositive = (periodChange ?? portfolio?.stxChange24h ?? 0) >= 0;
  const totalFlash = useFlashOnChange(portfolio?.totalUSD);

  // Demo portfolio that ticks subtly when wallet is disconnected — first-impression hook
  const [demoValue, setDemoValue] = useState(24521.83);
  useEffect(() => {
    if (isConnected) return;
    const id = setInterval(() => {
      setDemoValue((v) => {
        const drift = (Math.random() - 0.45) * 18;
        const next = v + drift;
        return Math.max(24200, Math.min(24900, next));
      });
    }, 2400);
    return () => clearInterval(id);
  }, [isConnected]);

  return (
    <div
      ref={cardRef}
      className="glass-card rounded-2xl p-5 overflow-hidden flex flex-col"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-[0.1em] uppercase text-fg-muted">
            Portfolio Value
          </span>
          {isConnected && (
            <a
              href={`https://explorer.hiro.so/address/${stxAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors text-fg-muted hover:text-brand"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Period selector */}
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-sunken">
          {(["1D", "1W", "1M", "1Y"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-150 ${
                period === p
                  ? "bg-surface text-fg shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
                  : "text-fg-muted"
              }`}
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
            <div className="h-11 w-52 rounded-lg skeleton" />
            <div className="h-4 w-64 rounded-lg skeleton" />
          </div>
        ) : isConnected && portfolio ? (
          <>
            <div className="flex items-baseline gap-3">
              <button
                type="button"
                onClick={() => setBreakdownOpen((v) => !v)}
                className="flex items-baseline gap-1.5 group rounded-lg -ml-1 px-1 transition-colors"
                title={breakdownOpen ? "Hide breakdown" : "Show portfolio breakdown"}
              >
                <AnimatedCounter
                  value={portfolio.totalUSD}
                  formatFn={formatUSD}
                  className={`text-4xl font-bold font-data group-hover:opacity-90 transition-opacity ${totalFlash}`}
                />
                <ChevronDown
                  size={18}
                  className="self-center transition-transform duration-200 text-fg-muted"
                  style={{ transform: breakdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>
              <span
                className={`flex items-center gap-1 text-sm font-semibold font-data px-2 py-0.5 rounded-lg ${
                  isPositive ? "text-pos bg-pos-soft" : "text-neg bg-neg-soft"
                }`}
              >
                {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {periodChangeUSD !== null && (
                  <span>
                    {isPositive ? "+" : "−"}
                    {formatUSD(Math.abs(periodChangeUSD))}
                  </span>
                )}
                <span className="opacity-[0.85]">
                  ({formatPercent(periodChange ?? portfolio.stxChange24h)})
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs mt-1.5 font-data flex-wrap text-fg-muted">
              <span>{formatSTX(portfolio.stxBalance)} STX</span>
              <span className="text-edge">·</span>
              <span className="text-fg-secondary">${portfolio.stxPrice.toFixed(4)}/STX</span>
              {portfolio.otherUSD > 0 && (
                <>
                  <span className="text-edge">·</span>
                  <Link href="/assets" className="transition-colors hover:underline text-brand">
                    +{formatUSD(portfolio.otherUSD)} other
                  </Link>
                </>
              )}
            </div>

            <AnimatePresence initial={false}>
              {breakdownOpen && (
                <PortfolioBreakdown
                  stxUsd={portfolio.stxUSD}
                  otherUsd={portfolio.otherUSD}
                  stackingUsd={portfolio.stackingUSD}
                  dcaUsd={dcaUsdLocked}
                  totalUsd={portfolio.totalUSD}
                  onDismiss={() => setBreakdownOpen(false)}
                />
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <AnimatedCounter
                value={demoValue}
                formatFn={formatUSD}
                duration={1200}
                className="text-4xl font-bold font-data text-fg opacity-[0.55]"
              />
              <span className="flex items-center gap-1 text-xs font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md text-brand bg-brand-soft">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-brand" />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-brand" />
                </span>
                Demo
              </span>
              <span className="text-sm font-semibold font-data px-2 py-0.5 rounded-lg text-pos bg-pos-soft opacity-[0.7]">
                +$234 (+1.9%)
              </span>
            </div>
            <p className="text-xs text-fg-muted">
              Sample portfolio · Connect to see your real holdings
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 self-start px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-brand text-[#060C18]"
              style={{ boxShadow: connecting ? 'none' : '0 0 14px var(--accent-glow)' }}
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
      <div className="flex-1 min-h-[110px] mt-2">
        {chartData.length > 0 ? (
          <BalanceCardChart chartData={chartData} isConnected={isConnected} isDark={isDark} />
        ) : (
          <ChartPlaceholder />
        )}
      </div>
    </div>
  );
}

export default React.memo(BalanceCard);
