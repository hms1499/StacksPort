"use client";

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { TokenImage } from "@/components/ui";

// protocol name → translation subkey under apps.explore.*
const NAME_KEY: Record<string, string> = {
  StackingDAO: "stackingdao",
  Lisa: "lisa",
  "Zest Protocol": "zest",
  Arkadiko: "arkadiko",
  Bitflow: "bitflow",
  ALEX: "alex",
  Velar: "velar",
};

interface ExploreProtocolCardProps {
  name: string;
  logoUrl: string;
  url: string;
  category: string;
  tagline: string;
}

export const EXPLORE_PROTOCOLS: ExploreProtocolCardProps[] = [
  {
    name: "StackingDAO",
    logoUrl: "https://stackingdao.com/favicon.ico",
    url: "https://stackingdao.com",
    category: "Liquid Staking",
    tagline: "Stake STX and receive stSTX, a liquid token earning stacking rewards",
  },
  {
    name: "Lisa",
    logoUrl: "https://lisa.finance/favicon.ico",
    url: "https://lisa.finance",
    category: "Liquid Staking",
    tagline: "Stake STX and receive LiSTX while keeping liquidity",
  },
  {
    name: "Zest Protocol",
    logoUrl: "https://www.zestprotocol.com/favicon.ico",
    url: "https://www.zestprotocol.com",
    category: "Lending",
    tagline: "Supply assets to earn yield or borrow against your crypto",
  },
  {
    name: "Arkadiko",
    logoUrl: "https://arkadiko.finance/favicon.ico",
    url: "https://app.arkadiko.finance",
    category: "CDP",
    tagline: "Mint USDA stablecoin by locking STX as collateral",
  },
  {
    name: "Bitflow",
    logoUrl: "https://bitflow.finance/favicon.ico",
    url: "https://bitflow.finance",
    category: "DEX",
    tagline: "Swap tokens on Stacks with low fees",
  },
  {
    name: "ALEX",
    logoUrl: "https://alexgo.io/favicon.ico",
    url: "https://app.alexgo.io",
    category: "DEX / Lending",
    tagline: "Trade, lend, and borrow across Stacks DeFi",
  },
  {
    name: "Velar",
    logoUrl: "https://www.velar.co/favicon.ico",
    url: "https://app.velar.co",
    category: "DEX",
    tagline: "Swap and provide liquidity on Stacks",
  },
];

export default function ExploreProtocolCard({
  name,
  logoUrl,
  url,
  category,
  tagline,
}: ExploreProtocolCardProps) {
  const t = useTranslations("apps");
  const key = NAME_KEY[name];
  const description = key ? t(`explore.${key}`) : tagline;
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-3">
        <TokenImage src={logoUrl} symbol={name} size={32} rounded="lg" fallback="none" />
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-sm truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {name}
          </p>
          <span
            className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5"
            style={{
              backgroundColor: "var(--accent-dim)",
              color: "var(--accent)",
            }}
          >
            {category}
          </span>
        </div>
      </div>
      <p className="text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
      <div className="flex justify-end">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "var(--accent-dim)",
            color: "var(--accent)",
          }}
        >
          {t("card.tryIt")} <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
