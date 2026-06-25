"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import YieldOpportunities from "@/components/earn/YieldOpportunities";
import IdleStxNudge from "@/components/earn/IdleStxNudge";
import YieldSummaryHero from "@/components/earn/YieldSummaryHero";
import YieldPositions from "@/components/earn/YieldPositions";
import EarnConnectBanner from "@/components/earn/EarnConnectBanner";
import { useWalletStore } from "@/store/walletStore";

// @stacks/* browser-only modules — skip SSR.
const StackingTracker = dynamic(
  () => import("@/components/earn/StackingTracker"),
  { ssr: false }
);

export default function EarnPageContent() {
  const t = useTranslations("earn");
  const isConnected = useWalletStore((s) => s.isConnected);
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={t("title")} />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <StaggerChildren className="space-y-4 md:space-y-5">
          {isConnected ? (
            <>
              <YieldSummaryHero />
              <MotionCard disableHover>
                <StackingTracker />
              </MotionCard>
              <YieldPositions />
              <IdleStxNudge />
            </>
          ) : (
            // Disconnected: one connect CTA instead of three stacked
            // per-card prompts; opportunities stay visible for discovery.
            <MotionCard disableHover>
              <EarnConnectBanner />
            </MotionCard>
          )}
          <MotionCard>
            <YieldOpportunities />
          </MotionCard>
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
