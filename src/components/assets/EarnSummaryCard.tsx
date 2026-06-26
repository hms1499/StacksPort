// src/components/assets/EarnSummaryCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Sprout, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useWalletStore } from "@/store/walletStore";
import { useTokensWithValues } from "@/hooks/useMarketData";
import { useStackingStatusSnap } from "@/hooks/usePortfolioSnapshot";
import { fetchStxPerStStx } from "@/lib/stacking-dao";
import { summarizeStackingPosition } from "@/lib/domain/stacking/position";

export default function EarnSummaryCard() {
  const t = useTranslations("assets.earnSummary");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: tokenData } = useTokensWithValues(addr);
  const { data: status } = useStackingStatusSnap(addr);

  const stStxBalance = useMemo(
    () => (tokenData?.tokens ?? []).find((tk) => tk.symbol === "stSTX")?.balance ?? 0,
    [tokenData]
  );
  const [microStxPerStStx, setMicroStxPerStStx] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    if (stStxBalance > 0) fetchStxPerStStx().then((r) => { if (active) setMicroStxPerStStx(r); });
    return () => { active = false; };
  }, [stStxBalance]);

  const summary = summarizeStackingPosition({
    stStxBalance,
    microStxPerStStx,
    poxLockedStx: status?.lockedSTX ?? 0,
    poxIsStacking: status?.isStacking ?? false,
  });

  return (
    <Link
      href="/earn"
      className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
             style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}>
          <Sprout size={18} />
        </div>
        <div>
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
            {t("title")}
          </p>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {summary.isEarning ? t("earning", { amount: summary.totalStx.toFixed(2) }) : t("empty")}
          </p>
        </div>
      </div>
      <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: "var(--accent-text)" }}>
        {t("cta")} <ArrowUpRight size={12} />
      </span>
    </Link>
  );
}
