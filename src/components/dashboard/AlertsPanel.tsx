"use client";

import { memo, useMemo } from "react";
import { Link } from "@/i18n/navigation";
import {
  Bell,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { usePriceAlertStore } from "@/store/priceAlertStore";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 5;

function AlertsPanel() {
  const alerts = usePriceAlertStore((s) => s.alerts);
  const resetAlert = usePriceAlertStore((s) => s.resetAlert);

  const { triggered, active, total } = useMemo(() => {
    const triggered = alerts
      .filter((a) => !!a.triggeredAt)
      .sort((a, b) => (b.triggeredAt ?? 0) - (a.triggeredAt ?? 0));
    const active = alerts
      .filter((a) => a.isActive && !a.triggeredAt)
      .sort((a, b) => b.createdAt - a.createdAt);
    return { triggered, active, total: alerts.length };
  }, [alerts]);

  // Auto-hide for accounts with zero alerts — don't clutter cold dashboards.
  if (total === 0) return null;

  const visible = [...triggered, ...active].slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, total - visible.length);

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell size={16} style={{ color: "var(--text-muted)" }} />
          <h3
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
          >
            Price Alerts
          </h3>
          {triggered.length > 0 && (
            <span
              className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md"
              style={{
                color: "var(--accent)",
                backgroundColor: "rgba(0, 229, 160, 0.12)",
              }}
            >
              {triggered.length} fired
            </span>
          )}
        </div>
        <Link
          href="/notifications"
          className="flex items-center gap-1 text-xs font-semibold transition-colors hover:underline"
          style={{ color: "var(--accent)" }}
        >
          Manage
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Alert list */}
      <ul className="space-y-2">
        {visible.map((alert) => {
          const isTriggered = !!alert.triggeredAt;
          const up = alert.condition === "above";

          return (
            <li
              key={alert.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                isTriggered && "ring-1"
              )}
              style={{
                backgroundColor: isTriggered
                  ? "rgba(0, 229, 160, 0.08)"
                  : "var(--border-subtle)",
                ...(isTriggered
                  ? {
                      // ring color via boxShadow so it works with arbitrary themes
                      boxShadow: "inset 0 0 0 1px var(--accent)",
                    }
                  : {}),
                opacity: !alert.isActive && !isTriggered ? 0.55 : 1,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: isTriggered
                    ? "rgba(0, 229, 160, 0.18)"
                    : up
                    ? "rgba(34, 197, 94, 0.12)"
                    : "rgba(239, 68, 68, 0.12)",
                  color: isTriggered
                    ? "var(--accent)"
                    : up
                    ? "#22c55e"
                    : "#ef4444",
                }}
              >
                {isTriggered ? (
                  <CheckCircle2 size={16} />
                ) : up ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold truncate font-data"
                  style={{ color: "var(--text-primary)" }}
                >
                  {alert.tokenSymbol}{" "}
                  <span
                    className="font-normal"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {up ? "above" : "below"}
                  </span>{" "}
                  ${alert.targetPrice.toLocaleString()}
                </p>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {isTriggered
                    ? `Fired ${formatRelative(alert.triggeredAt!)}`
                    : alert.isActive
                    ? "Watching"
                    : "Paused"}
                </p>
              </div>

              {isTriggered && (
                <button
                  onClick={() => resetAlert(alert.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:scale-105"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "#060C18",
                  }}
                  title="Re-arm alert"
                >
                  <RotateCcw size={11} />
                  Reset
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && (
        <Link
          href="/notifications"
          className="block text-center text-xs mt-3 transition-colors hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          +{hiddenCount} more {hiddenCount === 1 ? "alert" : "alerts"}
        </Link>
      )}
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default memo(AlertsPanel);
