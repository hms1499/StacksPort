"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import { useWalletStore } from "@/store/walletStore";
import DCAInPanel from "./DCAInPanel";
import DCAOutPanel from "./DCAOutPanel";
import PerformanceTabs from "./PerformanceTabs";

export default function DCAPerformanceContent() {
  const { isConnected, stxAddress } = useWalletStore();
  const [tab, setTab] = useState<"in" | "out">("in");

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="DCA Performance" />
      <AnimatedPage className="max-w-5xl mx-auto w-full px-4 py-6">
        <StaggerChildren className="flex flex-col gap-6">
          <MotionCard disableHover>
            <Link href="/dca"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft size={14} />
              Back to plans
            </Link>
          </MotionCard>

          <MotionCard disableHover>
            <PerformanceTabs active={tab} onChange={setTab} />
          </MotionCard>

          {tab === "in"
            ? <DCAInPanel isConnected={isConnected} stxAddress={stxAddress} />
            : <DCAOutPanel isConnected={isConnected} stxAddress={stxAddress} />}
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
