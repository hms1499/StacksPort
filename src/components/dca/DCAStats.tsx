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
      iconColor: "var(--accent)",
      bgColor: "var(--accent-dim)",
    },
    {
      icon: TrendingUp,
      label: "Total Volume",
      value: loading
        ? "—"
        : `${microToSTX(stats?.totalVolume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} STX`,
      iconColor: "#3B82F6",
      bgColor: "rgba(59, 130, 246, 0.1)",
    },
    {
      icon: Repeat2,
      label: "Swaps Executed",
      value: loading ? "—" : (stats?.totalExecuted ?? 0).toString(),
      iconColor: "#8B5CF6",
      bgColor: "rgba(139, 92, 246, 0.1)",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {items.map(({ icon: Icon, label, value, iconColor, bgColor }) => (
        <div
          key={label}
          className="glass-card rounded-2xl shadow-sm p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-4 text-center sm:text-left"
        >
          <div
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: bgColor }}
          >
            <Icon size={15} style={{ color: iconColor }} />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[9px] sm:text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-sm sm:text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
