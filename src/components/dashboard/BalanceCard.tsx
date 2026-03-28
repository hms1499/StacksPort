"use client";

import React, { useState } from "react";
import { TrendingDown, TrendingUp, ExternalLink, Loader2 } from "lucide-react";
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Balance</h2>
          {isConnected && (
            <a
              href={`https://explorer.hiro.so/address/${stxAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-[#408A71] transition-colors"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
        <div className="flex gap-1">
          {(["1D", "1W", "1M"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                period === p
                  ? "bg-gray-900 dark:bg-gray-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Balance display */}
      <div className="mt-3 mb-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse w-48" />
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse w-64" />
          </div>
        ) : isConnected && portfolio ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                {formatUSD(portfolio.totalUSD)}
              </span>
              <span
                className={`flex items-center gap-1 text-sm font-medium ${
                  isPositive ? "text-green-500" : "text-red-500"
                }`}
              >
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {formatPercent(portfolio.stxChange24h)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
              <span>{formatSTX(portfolio.stxBalance)} STX · ${portfolio.stxPrice.toFixed(4)}/STX</span>
              {portfolio.otherUSD > 0 && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-gray-400">+{formatUSD(portfolio.otherUSD)} other tokens</span>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold text-gray-300 dark:text-gray-600">---.--</p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 self-start bg-[#408A71] hover:bg-[#285A48] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              {connecting && <Loader2 size={14} className="animate-spin" />}
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          </div>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="stxGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: isDark ? "#6b7280" : "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: isDark ? "#1f2937" : "#fff",
                border: `1px solid ${isDark ? "#374151" : "#f3f4f6"}`,
                borderRadius: "10px",
                fontSize: 12,
                color: isDark ? "#f3f4f6" : "#111827",
              }}
              formatter={(v: unknown) => [
                isConnected
                  ? formatUSD(Number(v))
                  : `$${Number(v).toFixed(4)}`,
                isConnected ? "Portfolio" : "STX Price",
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#14b8a6"
              strokeWidth={2}
              fill="url(#stxGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[120px] bg-gray-50 dark:bg-gray-700/50 rounded-xl flex items-center justify-center">
          <span className="text-xs text-gray-400">Loading chart...</span>
        </div>
      )}
    </div>
  );
}

export default React.memo(BalanceCard);
