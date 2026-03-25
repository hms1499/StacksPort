"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Repeat2, LayoutList } from "lucide-react";
import { getDCAStats, microToSTX, type DCAStats } from "@/lib/dca";

export default function DCAStats() {
  const [stats, setStats] = useState<DCAStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDCAStats()
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
        : `${microToSTX(stats?.totalVolume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} STX`,
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
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {items.map(({ icon: Icon, label, value, color, bg }) => (
        <div
          key={label}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-4 text-center sm:text-left"
        >
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
            <Icon size={15} className={color} />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[9px] sm:text-xs text-gray-400 font-medium truncate">{label}</p>
            <p className="text-sm sm:text-lg font-bold text-gray-900 truncate">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
