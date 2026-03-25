"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Inbox } from "lucide-react";
import { getSBTCUserPlans, type DCA_SBTCPlan } from "@/lib/dca-sbtc";
import OutPlanCard from "./OutPlanCard";

interface Props {
  address: string;
}

export default function MyOutPlans({ address }: Props) {
  const [plans, setPlans] = useState<DCA_SBTCPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [userPlans, blockRes] = await Promise.all([
        getSBTCUserPlans(address),
        fetch("https://api.hiro.so/v2/info").then((r) => r.json()),
      ]);
      setPlans(userPlans);
      setCurrentBlock(blockRes.stacks_tip_height ?? 0);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">
          My Plans
          {plans.length > 0 && (
            <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              {plans.length}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {lastUpdated && !loading && (
            <span className="text-[10px] text-gray-300">
              {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
            <Inbox size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">No plans yet</p>
          <p className="text-xs text-gray-400">
            Create your first DCA Out plan to start selling sBTC for USDCx
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((plan) => (
            <OutPlanCard
              key={plan.id}
              plan={plan}
              currentBlock={currentBlock}
              onRefresh={fetchData}
            />
          ))}
        </div>
      )}
    </div>
  );
}
