"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useWalletStore } from "@/store/walletStore";
import { useTokensWithValues } from "@/hooks/useMarketData";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import PortfolioSummary from "@/components/assets/PortfolioSummary";
import HealthScore from "@/components/assets/HealthScore";
import PortfolioPerformanceChart from "@/components/assets/PortfolioPerformanceChart";
import YieldOpportunities from "@/components/assets/YieldOpportunities";

// Heavy widgets only mount when their tab is visited. SWR keeps the underlying
// snapshot warm across mounts, so switching tabs is a render cost, not a fetch.
const TokenHoldings = dynamic(
  () => import("@/components/assets/TokenHoldings"),
  { ssr: false }
);
const PnLTracker = dynamic(
  () => import("@/components/assets/PnLTracker"),
  { ssr: false }
);
const StackingTracker = dynamic(
  () => import("@/components/assets/StackingTracker"),
  { ssr: false }
);
const SBTCMonitor = dynamic(
  () => import("@/components/assets/SBTCMonitor"),
  { ssr: false }
);
const AssetTransactionHistory = dynamic(
  () => import("@/components/assets/AssetTransactionHistory"),
  { ssr: false }
);

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "holdings", label: "Holdings" },
  { key: "positions", label: "Positions" },
  { key: "activity", label: "Activity" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function TabNav({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <div
      className="flex gap-1 p-1 rounded-xl w-fit"
      style={{ backgroundColor: "var(--border-subtle)" }}
      role="tablist"
      aria-label="Assets sections"
    >
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
            style={
              isActive
                ? {
                    backgroundColor: "var(--bg-card)",
                    color: "var(--text-primary)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                  }
                : { color: "var(--text-muted)" }
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AssetsPageContent() {
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data, isLoading: loading } = useTokensWithValues(addr);
  const [tab, setTab] = useState<TabKey>("overview");

  const stx = data?.stx ?? null;
  const tokens = data?.tokens ?? [];
  const totalUsd = data?.totalUsd ?? 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="My Assets" />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <div className="mb-4 md:mb-5">
          <TabNav active={tab} onChange={setTab} />
        </div>

        <StaggerChildren className="space-y-4 md:space-y-5" key={tab}>
          {tab === "overview" && (
            <>
              <MotionCard disableHover>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <PortfolioSummary stx={stx} tokens={tokens} totalUsd={totalUsd} loading={loading} />
                  <HealthScore stx={stx} tokens={tokens} totalUsd={totalUsd} loading={loading} />
                </div>
              </MotionCard>
              <MotionCard>
                <PortfolioPerformanceChart />
              </MotionCard>
              <MotionCard>
                <YieldOpportunities />
              </MotionCard>
            </>
          )}

          {tab === "holdings" && (
            <>
              <MotionCard>
                <TokenHoldings stx={stx} tokens={tokens} totalUsd={totalUsd} loading={loading} />
              </MotionCard>
              <MotionCard>
                <PnLTracker />
              </MotionCard>
            </>
          )}

          {tab === "positions" && (
            <MotionCard disableHover>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <StackingTracker />
                <SBTCMonitor />
              </div>
            </MotionCard>
          )}

          {tab === "activity" && (
            <MotionCard>
              <AssetTransactionHistory />
            </MotionCard>
          )}
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
