"use client";

import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp, ExternalLink } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useWalletStore } from "@/store/walletStore";
import { getPortfolioValue, getPortfolioHistory, getSTXPriceHistory, PortfolioValue } from "@/lib/stacks";
import { formatUSD, formatSTX, formatPercent } from "@/lib/utils";

type Period = "1D" | "1W" | "1M";

export default function BalanceCard() {
  const { stxAddress, isConnected } = useWalletStore();
  const [portfolio, setPortfolio] = useState<PortfolioValue | null>(null);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);
  const [period, setPeriod] = useState<Period>("1W");
  const [loading, setLoading] = useState(false);

  const isPositive = (portfolio?.stxChange24h ?? 0) >= 0;
  const periodDays: Record<Period, number> = { "1D": 1, "1W": 7, "1M": 30 };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (isConnected && stxAddress) {
          const portfolioData = await getPortfolioValue(stxAddress);
          setPortfolio(portfolioData);
          // Chart shows real portfolio value history
          const history = await getPortfolioHistory(stxAddress, portfolioData, periodDays[period]);
          setChartData(history);
        } else {
          // Not connected: show STX price as market reference
          const history = await getSTXPriceHistory(periodDays[period]);
          setChartData(history);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stxAddress, isConnected, period]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-700">Balance</h2>
          {isConnected && (
            <a
              href={`https://explorer.hiro.so/address/${stxAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-teal-500 transition-colors"
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
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100"
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
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-48" />
            <div className="h-4 bg-gray-100 rounded-lg animate-pulse w-64" />
          </div>
        ) : isConnected && portfolio ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-gray-900">
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
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5 flex-wrap">
              <span>{formatSTX(portfolio.stxBalance)} STX · ${portfolio.stxPrice.toFixed(4)}/STX</span>
              {portfolio.otherUSD > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-400">+{formatUSD(portfolio.otherUSD)} other tokens</span>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold text-gray-300">---.--</p>
            <p className="text-sm text-gray-400">Connect wallet to view balance</p>
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
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #f3f4f6",
                borderRadius: "10px",
                fontSize: 12,
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
        <div className="h-[120px] bg-gray-50 rounded-xl flex items-center justify-center">
          <span className="text-xs text-gray-400">Loading chart...</span>
        </div>
      )}
    </div>
  );
}
