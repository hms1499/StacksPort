"use client";

import { ExternalLink, Lock, Unlock, Layers, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWalletStore } from "@/store/walletStore";
import { StackingStatus } from "@/lib/stacks";
import { useStackingStatusSnap } from "@/hooks/usePortfolioSnapshot";
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
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon size={14} className={iconColor} />
        </div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
          iconColor="text-[#285A48]"
          iconBg="bg-[#B0E4CC]/20"
        />
        <StatCard
          label={t("cyclesRemaining")}
          value={t("cyclesValue", { count: s.cyclesRemaining })}
          sub={t("unlocksIn", { days: s.estimatedUnlockDays })}
          icon={Layers}
          iconColor="text-indigo-500"
          iconBg="bg-indigo-50"
        />
        <StatCard
          label={t("unlockBlock")}
          value={`#${s.burnchainUnlockHeight.toLocaleString()}`}
          sub={t("btcBlocksLeft", { count: s.blocksUntilUnlock.toLocaleString() })}
          icon={Unlock}
          iconColor="text-orange-500"
          iconBg="bg-orange-50"
        />
      </div>

      {/* Cycle progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-600">
            {t("rewardPhase", { id: s.currentCycleId })}
          </p>
          <p className="text-xs text-gray-400">
            {t("blocksProgress", { elapsed: blocksElapsed.toLocaleString(), total: s.rewardPhaseLength.toLocaleString() })}
            <span className="ml-1.5 font-semibold text-gray-600">
              ({s.cycleProgress.toFixed(1)}%)
            </span>
          </p>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#B0E4CC] to-[#408A71] rounded-full transition-all duration-500"
            style={{ width: `${s.cycleProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-gray-400">
          <span>{t("cycleStart")}</span>
          <span>{t("blocksUntilPrepare", { count: s.blocksUntilCycleEnd.toLocaleString() })}</span>
        </div>
      </div>

      {/* Network info row */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>
            {t("networkShare")}{" "}
            <span className="font-semibold text-gray-600">
              {s.networkShare < 0.001 ? "<0.001" : s.networkShare.toFixed(3)}%
            </span>
          </span>
          <span>
            {t("totalStacked")}{" "}
            <span className="font-semibold text-gray-600">
              {formatLargeSTX(s.totalStackedUstx)}
            </span>
          </span>
        </div>
        {s.lockTxId && (
          <a
            href={`https://explorer.hiro.so/txid/${s.lockTxId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#408A71] hover:text-[#285A48] transition-colors"
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
  const bold = (c: React.ReactNode) => <span className="font-semibold text-gray-700">{c}</span>;

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
        <Info size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-500 space-y-1">
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
          className="flex items-center gap-1.5 text-sm text-[#285A48] font-medium hover:text-[#285A48] transition-colors"
        >
          {t("explorePools")} <ExternalLink size={13} />
        </a>
        <span className="text-gray-200">·</span>
        <a
          href="https://docs.stacks.co/concepts/stacking"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          {t("learnStacking")} <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-20" />
            <div className="h-6 bg-gray-200 rounded w-32" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-40" />
        <div className="h-2.5 bg-gray-100 rounded-full" />
      </div>
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

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-700">{t("title")}</h2>
          {!loading && status && (
            <span
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                status.isStacking
                  ? "bg-[#B0E4CC]/20 text-[#285A48]"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status.isStacking ? "bg-[#408A71]" : "bg-gray-400"
                }`}
              />
              {status.isStacking ? t("active") : t("notStacking")}
            </span>
          )}
        </div>
        {!loading && status && (
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg font-medium">
            {t("cycle", { id: status.currentCycleId })}
          </span>
        )}
      </div>

      {/* Content */}
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Lock size={32} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">{t("connect")}</p>
        </div>
      ) : loading ? (
        <SkeletonLoader />
      ) : status?.isStacking ? (
        <ActiveStacking s={status} />
      ) : status ? (
        <NotStacking s={status} />
      ) : null}
    </div>
  );
}
