"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Lock, Unlock, Layers, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWalletStore } from "@/store/walletStore";
import { StackingStatus } from "@/lib/stacks";
import { useStackingStatusSnap } from "@/hooks/usePortfolioSnapshot";
import { useTokensWithValues } from "@/hooks/useMarketData";
import { fetchStxPerStStx } from "@/lib/stacking-dao";
import { summarizeStackingPosition } from "@/lib/domain/stacking/position";
import { formatUSD } from "@/lib/utils";

function formatSTXAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatLargeSTX(ustx: number): string {
  const stx = ustx / 1_000_000;
  if (stx >= 1_000_000) return `${(stx / 1_000_000).toFixed(2)}M STX`;
  if (stx >= 1_000) return `${(stx / 1_000).toFixed(1)}K STX`;
  return `${stx.toFixed(0)} STX`;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-elevated)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          <Icon size={14} />
        </div>
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
      <p className="font-data text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      {sub && <p className="font-data text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function ActiveStacking({ s }: { s: StackingStatus }) {
  const t = useTranslations("assets.stacking");
  const blocksElapsed = Math.max(0, s.rewardPhaseLength - s.blocksUntilCycleEnd);

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label={t("lockedAmount")}
          value={`${formatSTXAmount(s.lockedSTX)} STX`}
          sub={formatUSD(s.lockedUsd)}
          icon={Lock}
          iconColor="#408A71"
          iconBg="rgba(64, 138, 113, 0.14)"
        />
        <StatCard
          label={t("cyclesRemaining")}
          value={t("cyclesValue", { count: s.cyclesRemaining })}
          sub={t("unlocksIn", { days: s.estimatedUnlockDays })}
          icon={Layers}
          iconColor="#6366F1"
          iconBg="rgba(99, 102, 241, 0.12)"
        />
        <StatCard
          label={t("unlockBlock")}
          value={`#${s.burnchainUnlockHeight.toLocaleString()}`}
          sub={t("btcBlocksLeft", { count: s.blocksUntilUnlock.toLocaleString() })}
          icon={Unlock}
          iconColor="#F59E0B"
          iconBg="rgba(245, 158, 11, 0.12)"
        />
      </div>

      {/* Cycle progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("rewardPhase", { id: s.currentCycleId })}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("blocksProgress", { elapsed: blocksElapsed.toLocaleString(), total: s.rewardPhaseLength.toLocaleString() })}
            <span className="font-data ml-1.5 font-semibold" style={{ color: "var(--text-secondary)" }}>
              ({s.cycleProgress.toFixed(1)}%)
            </span>
          </p>
        </div>
        <div
          className="w-full h-2.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--border-subtle)" }}
        >
          <div
            className="h-full bg-gradient-to-r from-[#B0E4CC] to-[#408A71] rounded-full transition-all duration-500"
            style={{ width: `${s.cycleProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span>{t("cycleStart")}</span>
          <span>{t("blocksUntilPrepare", { count: s.blocksUntilCycleEnd.toLocaleString() })}</span>
        </div>
      </div>

      {/* Network info row */}
      <div
        className="flex items-center justify-between pt-3 text-xs"
        style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
      >
        <div className="flex items-center gap-4">
          <span>
            {t("networkShare")}{" "}
            <span className="font-data font-semibold" style={{ color: "var(--text-secondary)" }}>
              {s.networkShare < 0.001 ? "<0.001" : s.networkShare.toFixed(3)}%
            </span>
          </span>
          <span>
            {t("totalStacked")}{" "}
            <span className="font-data font-semibold" style={{ color: "var(--text-secondary)" }}>
              {formatLargeSTX(s.totalStackedUstx)}
            </span>
          </span>
        </div>
        {s.lockTxId && (
          <a
            href={`https://explorer.hiro.so/txid/${s.lockTxId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors hover:underline"
            style={{ color: "var(--accent-text)" }}
          >
            {t("viewTx")} <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

function NotStacking({ s }: { s: StackingStatus }) {
  const t = useTranslations("assets.stacking");
  const nextCycleDays = Math.round((s.blocksUntilNextCycle * 10) / (60 * 24));
  const bold = (c: React.ReactNode) => (
    <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{c}</span>
  );

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
        <div className="text-sm space-y-1" style={{ color: "var(--text-secondary)" }}>
          <p>{t.rich("minToStack", { amount: s.minThresholdSTX.toLocaleString(), b: bold })}</p>
          <p>
            {t.rich("nextCycle", {
              id: s.currentCycleId + 1,
              blocks: s.blocksUntilNextCycle.toLocaleString(),
              days: nextCycleDays,
              b: bold,
            })}
          </p>
          <p>{t.rich("totalStackedWide", { amount: formatLargeSTX(s.totalStackedUstx), b: bold })}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href="https://stacking.club"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:underline"
          style={{ color: "var(--accent-text)" }}
        >
          {t("explorePools")} <ExternalLink size={13} />
        </a>
        <span style={{ color: "var(--border-default)" }}>·</span>
        <a
          href="https://docs.stacks.co/concepts/stacking"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm transition-colors hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          {t("learnStacking")} <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 space-y-2"
            style={{ backgroundColor: "var(--bg-elevated)" }}
          >
            <div className="h-3 w-20 rounded skeleton" />
            <div className="h-6 w-32 rounded skeleton" />
            <div className="h-3 w-24 rounded skeleton" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-3 w-40 rounded skeleton" />
        <div className="h-2.5 rounded-full skeleton" />
      </div>
    </div>
  );
}

function LiquidStacking({
  stStx,
  valueStx,
}: {
  stStx: number;
  valueStx: number | null;
}) {
  const t = useTranslations("assets.stacking");
  return (
    <div
      className="rounded-xl p-4 flex items-center justify-between gap-3"
      style={{ backgroundColor: "var(--bg-elevated)" }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "rgba(64, 138, 113, 0.14)", color: "#408A71" }}
        >
          <Lock size={14} />
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{t("liquidTitle")}</p>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {t("liquidStaked", { amount: formatSTXAmount(stStx) })}
          </p>
          {valueStx !== null && (
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {t("liquidValue", { stx: formatSTXAmount(valueStx) })}
            </p>
          )}
        </div>
      </div>
      <span
        className="text-[11px] font-semibold cursor-not-allowed"
        style={{ color: "var(--text-muted)" }}
        aria-disabled="true"
      >
        {t("unstakeSoon")}
      </span>
    </div>
  );
}

export default function StackingTracker() {
  const t = useTranslations("assets.stacking");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data, isLoading } = useStackingStatusSnap(addr);
  const status: StackingStatus | null = data ?? null;
  // Show skeleton only when we're loading AND have no cached data yet —
  // SWR keeps the previous snapshot during background refresh.
  const loading = isLoading && !status;

  const { data: tokenData } = useTokensWithValues(addr);
  const stStxBalance = useMemo(
    () => (tokenData?.tokens ?? []).find((tk) => tk.symbol === "stSTX")?.balance ?? 0,
    [tokenData]
  );

  const [microStxPerStStx, setMicroStxPerStStx] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    if (stStxBalance > 0) {
      fetchStxPerStStx().then((r) => { if (active) setMicroStxPerStStx(r); });
    }
    return () => { active = false; };
  }, [stStxBalance]);

  const summary = useMemo(
    () => summarizeStackingPosition({
      stStxBalance,
      microStxPerStStx,
      poxLockedStx: status?.lockedSTX ?? 0,
      poxIsStacking: status?.isStacking ?? false,
    }),
    [stStxBalance, microStxPerStStx, status]
  );

  return (
    <div className="glass-card no-hover-lift rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold" style={{ color: "var(--text-secondary)" }}>{t("title")}</h2>
          {!loading && status && (
            <span
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={
                summary.isEarning
                  ? { backgroundColor: "var(--accent-dim)", color: "var(--accent-text)" }
                  : { backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }
              }
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: summary.isEarning ? "var(--accent)" : "var(--text-muted)" }}
              />
              {summary.isEarning ? t("active") : t("notStacking")}
            </span>
          )}
        </div>
        {!loading && status && (
          <span
            className="text-xs px-2 py-1 rounded-lg font-medium"
            style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
          >
            {t("cycle", { id: status.currentCycleId })}
          </span>
        )}
      </div>

      {/* Content */}
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Lock size={32} className="mb-3" style={{ color: "var(--border-default)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("connect")}</p>
        </div>
      ) : loading ? (
        <SkeletonLoader />
      ) : summary.isEarning ? (
        <div className="space-y-5">
          {stStxBalance > 0 && (
            <LiquidStacking stStx={stStxBalance} valueStx={summary.liquidStx} />
          )}
          {status?.isStacking && <ActiveStacking s={status} />}
        </div>
      ) : status ? (
        <NotStacking s={status} />
      ) : null}
    </div>
  );
}
