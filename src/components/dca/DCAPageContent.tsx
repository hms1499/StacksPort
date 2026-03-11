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
          Tự động mua token định kỳ với STX · Testnet
        </p>
      </div>

      {/* Testnet notice */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="text-amber-500 text-lg">⚠️</span>
        <div>
          <p className="text-sm font-medium text-amber-700">Testnet only</p>
          <p className="text-xs text-amber-600">
            Contract:{" "}
            <span className="font-mono">
              ST18GQ5APPBQ0QF1ZR2CTCW6AV63EKT6T4FSMA9T0.dca-vault-v3
            </span>
          </p>
        </div>
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
              Kết nối ví để bắt đầu
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Cần kết nối ví Leather hoặc Xverse (Testnet mode)
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
            desc: "Phân tán rủi ro bằng cách mua token theo lịch cố định, không quan tâm đến biến động giá.",
          },
          {
            title: "Executor Reward",
            desc: "Bất kỳ ai cũng có thể trigger swap khi đến hạn và nhận 0.5% phần thưởng từ số tiền swap.",
          },
          {
            title: "Non-custodial",
            desc: "STX được giữ trực tiếp trong smart contract. Token mua được gửi thẳng về ví của bạn.",
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
