"use client";

import { useWalletStore } from "@/store/walletStore";
import { useTokensWithValues } from "@/hooks/useMarketData";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import PortfolioSummary from "@/components/assets/PortfolioSummary";
import HealthScore from "@/components/assets/HealthScore";
import TokenHoldings from "@/components/assets/TokenHoldings";
import StackingTracker from "@/components/assets/StackingTracker";
import SBTCMonitor from "@/components/assets/SBTCMonitor";
import AssetTransactionHistory from "@/components/assets/AssetTransactionHistory";
import PnLTracker from "@/components/assets/PnLTracker";

export default function AssetsPageContent() {
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data, isLoading: loading } = useTokensWithValues(addr);

  const stx = data?.stx ?? null;
  const tokens = data?.tokens ?? [];
  const totalUsd = data?.totalUsd ?? 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="My Assets" />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <StaggerChildren className="space-y-4 md:space-y-5">
          <MotionCard disableHover>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <PortfolioSummary stx={stx} tokens={tokens} totalUsd={totalUsd} loading={loading} />
              <HealthScore stx={stx} tokens={tokens} totalUsd={totalUsd} loading={loading} />
            </div>
          </MotionCard>
          <MotionCard>
            <TokenHoldings stx={stx} tokens={tokens} totalUsd={totalUsd} loading={loading} />
          </MotionCard>
          <MotionCard>
            <PnLTracker />
          </MotionCard>
          <MotionCard disableHover>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <StackingTracker />
              <SBTCMonitor />
            </div>
          </MotionCard>
          <MotionCard>
            <AssetTransactionHistory />
          </MotionCard>
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
