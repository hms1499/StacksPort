"use client";

import { memo, useMemo, useState } from "react";
import StakeStxModal from "./StakeStxModal";
import SupplyZestModal from "./SupplyZestModal";
import WithdrawZestModal from "./WithdrawZestModal";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Sparkles,
  Lock,
  Bitcoin,
  Repeat2,
  ExternalLink,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useUserDCAPlans, useTokensWithValues } from "@/hooks/useMarketData";
import { useStackingStatusSnap, useZestSbtcPosition } from "@/hooks/usePortfolioSnapshot";
import { useStackingApy } from "@/hooks/useYieldSnapshot";
import { stackingApyLabel } from "@/lib/stacking-apy-label";

type Opportunity = {
  id: string;
  labelKey: string;
  asset: string;
  apyRange: [number, number];
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  descKey: string;
  href: string;
  external: boolean;
  /** Computed at render time from wallet state. */
  status: "active" | "available";
  actionLabel: string;
};

// APY ranges are conservative public-knowledge estimates as of 2026 — labeled
// "Estimated" in the UI. Refresh annually or when protocols announce changes.
// Sources: stacking.club historic averages, Stacks ecosystem docs.
const BASE_OPPORTUNITIES: Omit<Opportunity, "status" | "actionLabel">[] = [
  {
    id: "stacking",
    labelKey: "stackingLabel",
    asset: "STX",
    apyRange: [7, 9],
    icon: Lock,
    iconColor: "#408A71",
    iconBg: "rgba(64, 138, 113, 0.14)",
    descKey: "stackingDesc",
    href: "https://stacking.club",
    external: false,
  },
  {
    id: "sbtc-yield",
    labelKey: "sbtcLabel",
    asset: "sBTC",
    apyRange: [3, 5],
    icon: Bitcoin,
    iconColor: "#F7931A",
    iconBg: "rgba(247, 147, 26, 0.14)",
    descKey: "sbtcDesc",
    href: "/trade",
    external: false,
  },
  {
    id: "dca",
    labelKey: "dcaLabel",
    asset: "Strategy",
    apyRange: [0, 0], // sentinel — DCA is not an APY product
    icon: Repeat2,
    iconColor: "#FFB547",
    iconBg: "rgba(255, 181, 71, 0.14)",
    descKey: "dcaDesc",
    href: "/dca",
    external: false,
  },
];

function YieldOpportunities() {
  const t = useTranslations("assets.yield");
  const tz = useTranslations("earn");
  const { stxAddress, isConnected } = useWalletStore();
  const { data: liveStackingApy } = useStackingApy();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: tokens } = useTokensWithValues(addr);
  const [stakeOpen, setStakeOpen] = useState(false);
  const [supplyOpen, setSupplyOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { data: zest } = useZestSbtcPosition(addr);
  const stxAvailable = tokens?.stx?.balance ?? 0;
  const stStxStaked = useMemo(
    () => (tokens?.tokens ?? []).find((t) => t.symbol === "stSTX")?.balance ?? 0,
    [tokens]
  );
  const sbtcAvailable = useMemo(
    () => (tokens?.tokens ?? []).find((t) => t.symbol === "sBTC")?.balance ?? 0,
    [tokens]
  );
  const { data: plans } = useUserDCAPlans(addr);

  // Liquid-stacking signal from token holdings (stSTX > 0).
  const hasLiquidStacking = useMemo(
    () => (tokens?.tokens ?? []).some((t) => t.symbol === "stSTX" && t.balance > 0),
    [tokens]
  );

  // Pooled / solo stacking signal — read from PoX, sourced from the same
  // portfolio snapshot to avoid a second round-trip on this page.
  const { data: stackingStatus } = useStackingStatusSnap(addr);
  const hasPoxStacking = stackingStatus?.isStacking ?? false;

  const isStacking = hasLiquidStacking || hasPoxStacking;
  const hasDca = (plans?.length ?? 0) > 0;
  const dcaExecutions = useMemo(
    () => (plans ?? []).reduce((sum, p) => sum + p.tsd, 0),
    [plans]
  );

  const opportunities: Opportunity[] = useMemo(() => {
    return BASE_OPPORTUNITIES.map((o) => {
      if (o.id === "stacking") {
        return {
          ...o,
          status: isStacking ? "active" : "available",
          actionLabel: isStacking ? t("viewPosition") : t("startStacking"),
        };
      }
      if (o.id === "dca") {
        return {
          ...o,
          status: hasDca ? "active" : "available",
          actionLabel: hasDca ? t("managePlans") : t("createPlan"),
        };
      }
      if (o.id === "sbtc-yield") {
        return {
          ...o,
          status: zest ? "active" : "available",
          actionLabel: t("explore"),
        };
      }
      return { ...o, status: "available" as const, actionLabel: t("explore") };
    });
  }, [isStacking, hasDca, zest, t]);

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--text-muted)" }} />
          <h3
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
          >
            {t("header")}
          </h3>
        </div>
        <span
          className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md"
          style={{
            color: "var(--text-muted)",
            backgroundColor: "var(--border-subtle)",
            letterSpacing: "0.08em",
          }}
        >
          {t("estimatedApy")}
        </span>
      </div>

      <ul className="space-y-2">
        {opportunities.map((o) => {
          const Icon = o.icon;
          const isDca = o.id === "dca";
          const apyLabel = isDca
            ? t("variable")
            : o.id === "stacking"
            ? stackingApyLabel(liveStackingApy, o.apyRange)
            : o.apyRange[0] === o.apyRange[1]
            ? `~${o.apyRange[0]}%`
            : `${o.apyRange[0]}–${o.apyRange[1]}%`;

          const subline = isDca && o.status === "active"
            ? t("subline", { count: dcaExecutions, desc: t(o.descKey) })
            : o.id === "sbtc-yield" && zest
            ? `${tz("zest.supplied")}: ${zest.suppliedSbtc.toFixed(8)} sBTC`
            : t(o.descKey);

          return (
            <li
              key={o.id}
              className="flex items-center gap-3 px-3 py-3 rounded-xl"
              style={{ backgroundColor: "var(--border-subtle)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: o.iconBg, color: o.iconColor }}
              >
                <Icon size={18} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {t(o.labelKey)}
                  </p>
                  {o.status === "active" && (
                    <span
                      className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md"
                      style={{
                        color: "var(--accent)",
                        backgroundColor: "rgba(0, 229, 160, 0.12)",
                      }}
                    >
                      <CheckCircle2 size={10} />
                      {t("active")}
                    </span>
                  )}
                </div>
                <p
                  className="text-[11px] mt-0.5 truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {subline}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span
                  className="text-sm font-bold font-data"
                  style={{ color: o.iconColor }}
                >
                  {apyLabel}
                </span>
                {o.id === "stacking" ? (
                  <button
                    onClick={() => setStakeOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {o.actionLabel}
                    <ArrowUpRight size={10} />
                  </button>
                ) : o.id === "sbtc-yield" ? (
                  <div className="flex items-center gap-2">
                    {zest && (
                      <button
                        onClick={() => setWithdrawOpen(true)}
                        className="text-[11px] font-semibold transition-colors hover:underline"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {tz("zest.withdrawCta")}
                      </button>
                    )}
                    <button
                      onClick={() => setSupplyOpen(true)}
                      className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:underline"
                      style={{ color: "var(--accent)" }}
                    >
                      {tz("zest.supplyCta")}
                      <ArrowUpRight size={10} />
                    </button>
                  </div>
                ) : o.external ? (
                  <a
                    href={o.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {o.actionLabel}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <Link
                    href={o.href}
                    className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {o.actionLabel}
                    <ArrowUpRight size={10} />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p
        className="text-[10px] mt-3 text-center"
        style={{ color: "var(--text-muted)" }}
      >
        {t("disclaimer")}
      </p>
      <StakeStxModal
        open={stakeOpen}
        onClose={() => setStakeOpen(false)}
        availableStx={stxAvailable}
        stStxStakedStx={stStxStaked}
      />
      <SupplyZestModal
        open={supplyOpen}
        onClose={() => setSupplyOpen(false)}
        availableSbtc={sbtcAvailable}
      />
      <WithdrawZestModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        suppliedSbtc={zest?.suppliedSbtc ?? 0}
      />
    </div>
  );
}

export default memo(YieldOpportunities);
