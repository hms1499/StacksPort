"use client";

import { useEffect, useState, useCallback } from "react";
import { useWalletStore } from "@/store/walletStore";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import EmptyState from "@/components/motion/EmptyState";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";
import { Wallet } from "lucide-react";
import { getUserPlans, type DCAPlan } from "@/lib/dca";
import { nextSwapCountdown } from "@/lib/dca-preview";

import DCAHeroSection, { type DCATab } from "./DCAHeroSection";
import CreatePlanForm from "./CreatePlanForm";
import MyPlans from "./MyPlans";
import InfoFooter from "./InfoFooter";
import CreateOutPlanForm from "@/components/dca-out/CreateOutPlanForm";
import MyOutPlans from "@/components/dca-out/MyOutPlans";

export default function DCAPageContent() {
  const { isConnected, stxAddress } = useWalletStore();
  const [tab, setTab] = useState<DCATab>("in");
  const [refreshKey, setRefreshKey] = useState(0);
  const [outRefreshKey, setOutRefreshKey] = useState(0);

  const [userPlans, setUserPlans] = useState<DCAPlan[]>([]);
  const [currentBlock, setCurrentBlock] = useState(0);

  useEffect(() => {
    if (!stxAddress) { setUserPlans([]); return; }
    getUserPlans(stxAddress).then(setUserPlans).catch(() => setUserPlans([]));
    fetch("https://api.hiro.so/v2/info")
      .then((r) => r.json())
      .then((d) => setCurrentBlock(d?.stacks_tip_height ?? 0))
      .catch(() => {});
  }, [stxAddress, refreshKey, outRefreshKey]);

  const activePlans = userPlans.filter((p) => p.active).length;
  const nextSwapLabel = nextSwapCountdown(userPlans, currentBlock);

  const handleRefresh    = useCallback(() => setRefreshKey((k) => k + 1), []);
  const handleOutRefresh = useCallback(() => setOutRefreshKey((k) => k + 1), []);

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="DCA Vault" />
      <AnimatedPage className="max-w-6xl mx-auto w-full px-4 py-6">
        <StaggerChildren className="flex flex-col gap-6">
          <MotionCard disableHover>
            <DCAHeroSection
              tab={tab}
              onTabChange={setTab}
              isConnected={isConnected}
              userActivePlans={activePlans}
              userNextSwapLabel={nextSwapLabel}
            />
          </MotionCard>

          <MotionCard disableHover>
            {!isConnected ? (
              <div className="glass-card rounded-2xl" style={{ boxShadow: "var(--shadow-card)" }}>
                <EmptyState
                  icon={<Wallet size={28} style={{ color: "var(--accent)" }} />}
                  title="Connect your wallet to get started"
                  description="Connect a Leather or Xverse wallet to create and manage your DCA plans."
                  action={<ConnectWalletCTA />}
                />
              </div>
            ) : tab === "in" ? (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
                <div className="lg:sticky lg:top-6">
                  <CreatePlanForm onCreated={handleRefresh} />
                </div>
                <div>
                  <MyPlans key={refreshKey} address={stxAddress!} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
                <div className="lg:sticky lg:top-6">
                  <CreateOutPlanForm onCreated={handleOutRefresh} />
                </div>
                <div>
                  <MyOutPlans key={outRefreshKey} address={stxAddress!} />
                </div>
              </div>
            )}
          </MotionCard>

          <MotionCard disableHover>
            <InfoFooter tab={tab} />
          </MotionCard>
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
