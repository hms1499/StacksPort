"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Sprout, TrendingUp } from "lucide-react";
import AnimatedCounter from "@/components/motion/AnimatedCounter";
import { useWalletStore } from "@/store/walletStore";
import { useConnectedApps, useProtocolPositions } from "@/hooks/useMarketData";
import { useYieldSnapshot } from "@/hooks/useYieldSnapshot";
import { estimateAnnualYield } from "@/lib/earn-yield";

export default function YieldSummaryHero() {
  const t = useTranslations("earn.summary");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: apps, isLoading: appsLoading } = useConnectedApps(addr);
  const { data: positionsMap, isLoading: positionsLoading } = useProtocolPositions(
    addr,
    apps?.knownProtocols ?? []
  );
  const { data: yieldSnap } = useYieldSnapshot();

  const { totalAtWork, annualYield } = useMemo(
    () => estimateAnnualYield(positionsMap ?? new Map(), yieldSnap),
    [positionsMap, yieldSnap]
  );
  // Show a skeleton while positions are still loading rather than the empty CTA.
  const loading = appsLoading || positionsLoading;

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm flex items-start gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}
      >
        <Sprout size={22} />
      </div>
      <div className="flex-1">
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
          {t("header")}
        </p>
        {!isConnected ? (
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{t("connectPrompt")}</p>
        ) : loading ? (
          <div className="h-8 w-48 rounded skeleton mt-1.5" />
        ) : totalAtWork > 0 ? (
          <div className="flex items-end justify-between gap-3 mt-1 flex-wrap">
            <div>
              <AnimatedCounter
                value={totalAtWork}
                formatFn={(v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                className="text-3xl font-bold font-data"
                style={{ color: "var(--text-primary)" }}
              />
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{t("atWork")}</p>
            </div>
            {annualYield !== null && (
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className="flex items-center gap-1 text-xs font-bold font-data px-2 py-1 rounded-lg"
                  style={{ color: "var(--accent)", backgroundColor: "var(--accent-dim)" }}
                >
                  <TrendingUp size={12} />
                  <AnimatedCounter
                    value={annualYield}
                    formatFn={(v) => `~$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  />
                  {t("perYear")}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t("estYearly")}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
