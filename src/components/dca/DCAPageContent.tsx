"use client";

import { useState } from "react";
import { useWalletStore } from "@/store/walletStore";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import DCAStats from "./DCAStats";
import CreatePlanForm from "./CreatePlanForm";
import MyPlans from "./MyPlans";
import DCAOutStats from "@/components/dca-out/DCAOutStats";
import CreateOutPlanForm from "@/components/dca-out/CreateOutPlanForm";
import MyOutPlans from "@/components/dca-out/MyOutPlans";
import { Wallet, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import EmptyState from "@/components/motion/EmptyState";

type Tab = "in" | "out";

export default function DCAPageContent() {
  const { isConnected, stxAddress } = useWalletStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const [outRefreshKey, setOutRefreshKey] = useState(0);
  const [tab, setTab] = useState<Tab>("in");

  const handleRefresh = () => setRefreshKey((k) => k + 1);
  const handleOutRefresh = () => setOutRefreshKey((k) => k + 1);

  const tabs: { key: Tab; label: string; icon: typeof ArrowDownToLine; desc: string }[] = [
    { key: "in", label: "DCA In", icon: ArrowDownToLine, desc: "STX → sBTC" },
    { key: "out", label: "DCA Out", icon: ArrowUpFromLine, desc: "sBTC → USDCx" },
  ];

  const infoFooter = tab === "in"
    ? [
        {
          title: "Dollar-Cost Averaging",
          desc: "Spread your risk by buying tokens on a fixed schedule, regardless of price fluctuations.",
        },
        {
          title: "0.3% Protocol Fee",
          desc: "0.3% of each swap goes to the treasury. The remaining 99.7% is used to purchase sBTC via Bitflow.",
        },
        {
          title: "Non-custodial",
          desc: "STX is held directly in the smart contract. Purchased tokens are sent straight to your wallet.",
        },
      ]
    : [
        {
          title: "Dollar-Cost Averaging Out",
          desc: "Gradually sell sBTC for USDCx on a fixed schedule to lock in value over time.",
        },
        {
          title: "0.3% Protocol Fee",
          desc: "0.3% of each swap goes to the treasury. The remaining 99.7% is swapped via the 3-hop Bitflow route.",
        },
        {
          title: "3-Hop Swap",
          desc: "sBTC → STX → aeUSDC → USDCx. All swaps are routed through Bitflow pools automatically.",
        },
      ];

  return (
    <div className="flex flex-col min-h-screen">
    <Topbar />
    <AnimatedPage className="max-w-6xl mx-auto w-full px-4 py-6">
      <StaggerChildren className="flex flex-col gap-6">
        {/* Page header */}
        <MotionCard>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">DCA Vault</h1>
            <p className="text-sm text-gray-400 mt-1">
              {tab === "in"
                ? "Automatically buy sBTC on a schedule with STX · Powered by Bitflow"
                : "Automatically sell sBTC for USDCx on a schedule · Powered by Bitflow"}
            </p>
          </div>
        </MotionCard>

        {/* Tab navigator */}
        <MotionCard>
          <div className="flex gap-2">
            {tabs.map(({ key, label, icon: Icon, desc }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  tab === key
                    ? "bg-[#408A71] text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-500 hover:border-[#B0E4CC] hover:text-gray-700"
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
                <span className={`text-[10px] hidden sm:inline ${tab === key ? "text-[#B0E4CC]/30" : "text-gray-300"}`}>
                  {desc}
                </span>
              </button>
            ))}
          </div>
        </MotionCard>

        {/* Protocol stats */}
        <MotionCard>
          {tab === "in" ? <DCAStats /> : <DCAOutStats />}
        </MotionCard>

        {/* Main content */}
        <MotionCard>
          {!isConnected ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <EmptyState
                icon={<Wallet size={28} className="text-[#408A71]" />}
                title="Connect your wallet to get started"
                description="Connect a Leather or Xverse wallet to create and manage your DCA plans."
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

        {/* Info footer */}
        <MotionCard>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            {infoFooter.map(({ title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </MotionCard>
      </StaggerChildren>
    </AnimatedPage>
    </div>
  );
}
