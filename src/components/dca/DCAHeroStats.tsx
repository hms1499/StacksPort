"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BarChart3, ArrowUpRight } from "lucide-react";
import { getDCAStats, microToSTX, type DCAStats } from "@/lib/dca";
import AnimatedCounter from "@/components/motion/AnimatedCounter";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";

interface DCAHeroStatsProps {
  isConnected: boolean;
  userActivePlans: number;           // count; 0 if none
  userNextSwapLabel: string | null;  // e.g. "~2h", "Ready", or null when no active plans
  mode: "in" | "out";                // for gradient text color of the values
}

export default function DCAHeroStats({
  isConnected,
  userActivePlans,
  userNextSwapLabel,
  mode,
}: DCAHeroStatsProps) {
  const t = useTranslations("dca.stats");
  const [stats, setStats] = useState<DCAStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDCAStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const tvlStx = microToSTX(stats?.totalVolume ?? 0);
  const gradClass = mode === "in" ? "gradient-text-dca-in" : "gradient-text-dca-out";

  return (
    <div className="flex flex-col gap-4">
      {/* Protocol row */}
      <div className="grid grid-cols-2 gap-4">
        <StatBlock
          label={t("totalVolume")}
          value={
            loading ? "—" : (
              <AnimatedCounter
                value={tvlStx}
                formatFn={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                className={`text-2xl sm:text-3xl font-bold font-data ${gradClass}`}
              />
            )
          }
          suffix="STX"
        />
        <StatBlock
          label={t("swapsExecuted")}
          value={
            loading ? "—" : (
              <AnimatedCounter
                value={stats?.totalExecuted ?? 0}
                formatFn={(v) => Math.round(v).toString()}
                className={`text-2xl sm:text-3xl font-bold font-data ${gradClass}`}
              />
            )
          }
        />
      </div>

      {/* User row */}
      <div className="border-t pt-4" style={{ borderColor: "var(--border-subtle)" }}>
        {isConnected ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <StatBlock
                label={t("yourActivePlans")}
                value={
                  <AnimatedCounter
                    value={userActivePlans}
                    formatFn={(v) => Math.round(v).toString()}
                    className={`text-xl sm:text-2xl font-bold font-data ${gradClass}`}
                  />
                }
              />
              <StatBlock
                label={t("nextSwap")}
                value={
                  <span className={`text-xl sm:text-2xl font-bold font-data ${gradClass}`}>
                    {userNextSwapLabel ?? "—"}
                  </span>
                }
              />
            </div>
            {userActivePlans > 0 && (
              <Link
                href="/dca/performance"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors group"
                style={{ color: 'var(--accent-2)' }}
              >
                <BarChart3 size={12} />
                {t("viewPerformance")}
                <ArrowUpRight size={11} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            )}
          </>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {t("connectPrompt")}
            </p>
            <ConnectWalletCTA />
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  suffix,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        {value}
        {suffix && <span className="text-sm" style={{ color: "var(--text-muted)" }}>{suffix}</span>}
      </div>
    </div>
  );
}
