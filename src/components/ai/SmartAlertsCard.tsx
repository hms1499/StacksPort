"use client";

import { Zap, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertItem } from "@/lib/ai";

const typeConfig = {
  opportunity: {
    icon: Zap,
    border: "border-l-teal-500",
    iconColor: "text-teal-500",
    bg: "bg-teal-50 dark:bg-teal-900/10",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-l-amber-500",
    iconColor: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/10",
  },
  info: {
    icon: Info,
    border: "border-l-blue-500",
    iconColor: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/10",
  },
};

const priorityBadge = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

export default function SmartAlertsCard({ items }: { items: AlertItem[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Smart Alerts</h3>

      <div className="space-y-3">
        {items.map((alert, i) => {
          const config = typeConfig[alert.type];
          const Icon = config.icon;
          return (
            <div
              key={i}
              className={cn(
                "flex gap-3 p-3 rounded-xl border-l-4",
                config.border,
                config.bg
              )}
            >
              <Icon size={18} className={cn("shrink-0 mt-0.5", config.iconColor)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {alert.title}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full",
                      priorityBadge[alert.priority]
                    )}
                  >
                    {alert.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {alert.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
