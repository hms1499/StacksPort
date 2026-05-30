"use client";

import type { CSSProperties } from "react";
import { Zap, AlertTriangle, Info } from "lucide-react";
import type { AlertItem } from "@/lib/ai";

// Theme-agnostic colors: rgba tints + CSS vars work on both light and dark,
// unlike the hardcoded *-50/*-100 light-mode utilities this replaced (which
// rendered as near-white blocks in dark mode).
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";

const typeConfig: Record<
  AlertItem["type"],
  { icon: typeof Zap; rowStyle: CSSProperties; iconStyle: CSSProperties }
> = {
  opportunity: {
    icon: Zap,
    rowStyle: { borderLeftColor: "var(--accent)", backgroundColor: "var(--accent-dim)" },
    iconStyle: { color: "var(--accent)" },
  },
  warning: {
    icon: AlertTriangle,
    rowStyle: { borderLeftColor: AMBER, backgroundColor: "rgba(245,158,11,0.10)" },
    iconStyle: { color: AMBER },
  },
  info: {
    icon: Info,
    rowStyle: { borderLeftColor: BLUE, backgroundColor: "rgba(59,130,246,0.10)" },
    iconStyle: { color: BLUE },
  },
};

const priorityBadge: Record<AlertItem["priority"], CSSProperties> = {
  high:   { backgroundColor: "rgba(248,113,113,0.15)", color: "#F87171" },
  medium: { backgroundColor: "rgba(251,191,36,0.15)", color: "#FBBF24" },
  low:    { backgroundColor: "var(--bg-elevated)", color: "var(--text-muted)" },
};

export default function SmartAlertsCard({ items }: { items: AlertItem[] }) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Smart Alerts</h3>

      <div className="space-y-3">
        {items.map((alert, i) => {
          const config = typeConfig[alert.type];
          const Icon = config.icon;
          return (
            <div
              key={i}
              className="flex gap-3 p-3 rounded-xl border-l-4"
              style={config.rowStyle}
            >
              <Icon size={18} className="shrink-0 mt-0.5" style={config.iconStyle} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {alert.title}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                    style={priorityBadge[alert.priority]}
                  >
                    {alert.priority}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
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
