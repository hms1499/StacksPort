// src/components/assets/IdleStxNudge.tsx
"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useTokensWithValues } from "@/hooks/useMarketData";
import { stxToMicro, microToSTX } from "@/lib/dca";
import { idleStx } from "@/lib/domain/stacking/amount";
import { MIN_STAKE_USTX } from "@/lib/domain/stacking/contracts";
import StakeStxModal from "./StakeStxModal";

// Headline APY shown in the nudge — same sourced estimate as YieldOpportunities.
const STACKING_APY = 8;

export default function IdleStxNudge() {
  const t = useTranslations("assets.stake");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: tokens } = useTokensWithValues(addr);
  const [open, setOpen] = useState(false);

  const stxAvailable = useMemo(
    () => (tokens?.tokens ?? []).find((t) => t.symbol === "STX")?.balance ?? 0,
    [tokens]
  );
  const stStxStaked = useMemo(
    () => (tokens?.tokens ?? []).find((t) => t.symbol === "stSTX")?.balance ?? 0,
    [tokens]
  );

  const idleUstx = idleStx(stxToMicro(stxAvailable));
  const eligible = addr && idleUstx >= MIN_STAKE_USTX && stStxStaked === 0;

  if (!eligible) return null;

  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-3" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--accent-dim)" }}>
        <Sparkles size={16} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
          {t("nudgeTitle", { amount: microToSTX(idleUstx).toFixed(0) })}
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {t("nudgeBody", { apy: STACKING_APY })}
        </p>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl px-3 py-2 text-xs font-semibold shrink-0"
        style={{ background: "var(--accent)", color: "#04130d" }}
      >
        {t("nudgeCta")}
      </button>
      <StakeStxModal open={open} onClose={() => setOpen(false)} availableStx={stxAvailable} stStxStakedStx={stStxStaked} />
    </div>
  );
}
