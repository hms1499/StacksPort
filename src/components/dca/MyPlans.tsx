"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Repeat2 } from "lucide-react";
import { getUserPlans, type DCAPlan } from "@/lib/dca";
import PlanCard from "./PlanCard";
import EmptyState from "@/components/motion/EmptyState";

interface Props {
  address: string;
}

export default function MyPlans({ address }: Props) {
  const [plans, setPlans] = useState<DCAPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [userPlans, blockRes] = await Promise.all([
        getUserPlans(address),
        fetch("https://api.hiro.so/v2/info").then((r) => r.json()),
      ]);
      setPlans(userPlans);
      setCurrentBlock(blockRes.stacks_tip_height ?? 0);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
    // const interval = setInterval(fetchData, 30000);
    // return () => clearInterval(interval);
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <EmptyState
            icon={<Repeat2 size={28} className="text-[#408A71]" />}
            title="No DCA plans yet"
            description="Create your first plan to start automated dollar-cost averaging into sBTC."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((plan) => (
            <PlanCard
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
