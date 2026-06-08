"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, Coins, ShieldCheck, type LucideIcon } from "lucide-react";

interface InfoFooterProps {
  tab: "in" | "out";
}

interface FooterCard {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

const CONTENT: Record<"in" | "out", FooterCard[]> = {
  in: [
    { icon: TrendingUp,  titleKey: "inDcaTitle",     descKey: "inDcaDesc" },
    { icon: Coins,       titleKey: "inFeeTitle",     descKey: "inFeeDesc" },
    { icon: ShieldCheck, titleKey: "inCustodyTitle", descKey: "inCustodyDesc" },
  ],
  out: [
    { icon: TrendingDown, titleKey: "outDcaTitle",  descKey: "outDcaDesc" },
    { icon: Coins,        titleKey: "outFeeTitle",  descKey: "outFeeDesc" },
    { icon: ShieldCheck,  titleKey: "outSwapTitle", descKey: "outSwapDesc" },
  ],
};

export default function InfoFooter({ tab }: InfoFooterProps) {
  const t = useTranslations("dca.info");
  const cards = CONTENT[tab];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
      {cards.map(({ icon: Icon, titleKey, descKey }) => (
        <div
          key={titleKey}
          className="glass-card rounded-2xl p-4 transition-all hover:-translate-y-0.5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: "var(--accent-dim)" }}
          >
            <Icon size={18} style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{t(titleKey)}</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{t(descKey)}</p>
        </div>
      ))}
    </div>
  );
}
