"use client";

import { useState } from "react";
import { useWalletStore } from "@/store/walletStore";
import Topbar from "@/components/layout/Topbar";
import DCAStats from "./DCAStats";
import CreatePlanForm from "./CreatePlanForm";
import MyPlans from "./MyPlans";
import { Wallet } from "lucide-react";

export default function DCAPageContent() {
  const { isConnected, stxAddress } = useWalletStore();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex flex-col min-h-screen">
    <Topbar />
    <div className="max-w-6xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">DCA Vault</h1>
        <p className="text-sm text-gray-400 mt-1">
          Automatically buy sBTC on a schedule with STX · Powered by Bitflow
        </p>
      </div>

      {/* Protocol stats */}
      <DCAStats />

      {/* Main content */}
      {!isConnected ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center">
            <Wallet size={26} className="text-teal-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">
              Connect your wallet to get started
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Connect a Leather or Xverse wallet
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          {/* Create plan form */}
          <div className="lg:sticky lg:top-6">
            <CreatePlanForm onCreated={handleRefresh} />
          </div>

          {/* My plans */}
          <div>
            <MyPlans key={refreshKey} address={stxAddress!} />
          </div>
        </div>
      )}

      {/* Info footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        {[
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
        ].map(({ title, desc }) => (
          <div
            key={title}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
          >
            <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
            <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
