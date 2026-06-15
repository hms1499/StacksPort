"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp, Zap, Loader2 } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { connectWallet } from "@/lib/wallet";
import type { BacktestResult } from "@/lib/server/backtest-snapshot";

interface Props {
  backtest: BacktestResult | null;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-base font-bold" style={{ color: accent ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

export default function DcaBacktestHero({ backtest }: Props) {
  const t = useTranslations("dashboard.backtest");
  const { isConnected, connect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);

  // Value only for not-yet-connected visitors; hidden once a wallet is on,
  // or when the backtest data is unavailable (never show a broken/empty widget).
  if (isConnected || !backtest) return null;

  const growthPct = backtest.growthPct;
  const positive = growthPct >= 0;

  async function handleConnect() {
    setConnecting(true);
    try {
      await connectWallet(connect);
    } catch {
      // user cancelled
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div
      className="glass-card rounded-2xl p-5 md:p-6 shadow-sm mb-4 md:mb-5"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={15} style={{ color: "var(--accent)" }} />
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {t("eyebrow")}
        </span>
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        {t("scenario", { stx: 50 })}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label={t("sbtcLabel")} value={`${backtest.totalSbtcOut.toFixed(4)} sBTC`} />
        <Stat label={t("valueLabel")} value={`$${Math.round(backtest.currentValueUsd).toLocaleString()}`} />
        <Stat
          label={t("growthLabel")}
          value={`${positive ? "+" : ""}${growthPct.toFixed(1)}%`}
          accent={positive ? "var(--positive)" : "var(--negative)"}
        />
      </div>

      <button
        onClick={handleConnect}
        disabled={connecting}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--accent)",
          boxShadow: connecting ? "none" : "0 0 16px var(--accent-glow)",
        }}
      >
        {connecting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
        {t("cta")}
      </button>

      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        {t("disclaimer")}
      </p>
    </div>
  );
}
