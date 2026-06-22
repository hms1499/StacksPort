"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Sprout } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useConnectedApps, useProtocolPositions } from "@/hooks/useMarketData";
import { useYieldSnapshot } from "@/hooks/useYieldSnapshot";
import { estimateAnnualYield } from "@/lib/earn-yield";

export default function YieldSummaryHero() {
  const t = useTranslations("earn.summary");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: apps } = useConnectedApps(addr);
  const { data: positionsMap } = useProtocolPositions(addr, apps?.knownProtocols ?? []);
  const { data: yieldSnap } = useYieldSnapshot();

  const { totalAtWork, annualYield } = useMemo(
    () => estimateAnnualYield(positionsMap ?? new Map(), yieldSnap),
    [positionsMap, yieldSnap]
  );

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm flex items-center gap-4">
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
        {totalAtWork > 0 ? (
          <div className="flex items-baseline gap-4 mt-1 flex-wrap">
            <span className="text-lg font-bold font-data" style={{ color: "var(--text-primary)" }}>
              ${totalAtWork.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              <span className="text-[11px] font-normal ml-1" style={{ color: "var(--text-muted)" }}>{t("atWork")}</span>
            </span>
            {annualYield !== null && (
              <span className="text-sm font-bold font-data" style={{ color: "var(--accent)" }}>
                ~${annualYield.toLocaleString(undefined, { maximumFractionDigits: 2 })}{t("perYear")}
                <span className="text-[11px] font-normal ml-1" style={{ color: "var(--text-muted)" }}>{t("estYearly")}</span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
