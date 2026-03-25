"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Repeat2, LayoutList } from "lucide-react";
import { getSBTCDCAStats, satsToBTC, type DCA_SBTCStats } from "@/lib/dca-sbtc";

export default function DCAOutStats() {
  const [stats, setStats] = useState<DCA_SBTCStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSBTCDCAStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const items = [
    {
      icon: LayoutList,
      label: "Total Plans",
      value: loading ? "—" : (stats?.totalPlans ?? 0).toString(),
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
    {
      icon: TrendingUp,
      label: "Total Volume",
      value: loading
        ? "—"
        : `${satsToBTC(stats?.totalVolume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })} sBTC`,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Repeat2,
      label: "Swaps Executed",
      value: loading ? "—" : (stats?.totalExecuted ?? 0).toString(),
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map(({ icon: Icon, label, value, color, bg }) => (
        <div
          key={label}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4"
        >
          <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={18} className={color} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">{label}</p>
            <p className="text-lg font-bold text-gray-900">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
