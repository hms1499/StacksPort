"use client";

import { TrendingUp, TrendingDown, Coins, ShieldCheck, type LucideIcon } from "lucide-react";

interface InfoFooterProps {
  tab: "in" | "out";
}

interface FooterCard {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const CONTENT: Record<"in" | "out", FooterCard[]> = {
  in: [
    { icon: TrendingUp,  title: "Dollar-Cost Averaging", desc: "Spread your risk by buying tokens on a fixed schedule, regardless of price fluctuations." },
    { icon: Coins,       title: "0.3% Protocol Fee",     desc: "0.3% of each swap goes to the treasury. The remaining 99.7% is used to purchase sBTC via Bitflow." },
    { icon: ShieldCheck, title: "Non-custodial",          desc: "STX is held directly in the smart contract. Purchased tokens are sent straight to your wallet." },
  ],
  out: [
    { icon: TrendingDown, title: "Dollar-Cost Averaging Out", desc: "Gradually sell sBTC for USDCx on a fixed schedule to lock in value over time." },
    { icon: Coins,        title: "0.3% Protocol Fee",         desc: "0.3% of each swap goes to the treasury. The remaining 99.7% is swapped via the 3-hop Bitflow route." },
    { icon: ShieldCheck,  title: "3-Hop Swap",                desc: "sBTC → STX → aeUSDC → USDCx. All swaps are routed through Bitflow pools automatically." },
  ],
};

export default function InfoFooter({ tab }: InfoFooterProps) {
  const cards = CONTENT[tab];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
      {cards.map(({ icon: Icon, title, desc }) => (
        <div
          key={title}
          className="glass-card rounded-2xl p-4 transition-all hover:-translate-y-0.5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: "var(--accent-dim)" }}
          >
            <Icon size={18} style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{title}</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
        </div>
      ))}
    </div>
  );
}
