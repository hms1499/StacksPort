"use client";

import Link from "next/link";
import { Repeat2, ChevronRight, Zap, PauseCircle } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useUserDCAPlans } from "@/hooks/useMarketData";
import { blocksToInterval, microToSTX } from "@/lib/dca";

export default function DCASummaryCard() {
  const { isConnected, stxAddress } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: plans, isLoading } = useUserDCAPlans(addr);

  if (!isConnected) return null;

  const activePlans = (plans ?? []).filter((p) => p.active);
  const pausedPlans = (plans ?? []).filter((p) => !p.active);
  const totalBalanceSTX = (plans ?? []).reduce((sum, p) => sum + microToSTX(p.bal), 0);
  const totalSwapsDone = (plans ?? []).reduce((sum, p) => sum + p.tsd, 0);

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "var(--accent)", opacity: 0.9 }}
          >
            <Repeat2 size={14} style={{ color: "#060C18" }} />
          </div>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            DCA Plans
          </h2>
        </div>
        <Link
          href="/dca"
          className="flex items-center gap-0.5 text-xs font-medium transition-colors"
          style={{ color: "var(--accent)" }}
        >
          Manage <ChevronRight size={13} />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-xl animate-pulse"
              style={{ backgroundColor: "var(--border-subtle)" }}
            />
          ))}
        </div>
      ) : (plans ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No DCA plans yet
          </p>
          <Link
            href="/dca"
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              backgroundColor: "var(--accent)",
              color: "#060C18",
            }}
          >
            Create your first plan
          </Link>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Active</p>
              <p className="text-lg font-bold font-data" style={{ color: "var(--text-primary)" }}>
                {activePlans.length}
                {pausedPlans.length > 0 && (
                  <span className="text-xs font-normal ml-1" style={{ color: "var(--text-muted)" }}>
                    +{pausedPlans.length} paused
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Balance</p>
              <p className="text-lg font-bold font-data" style={{ color: "var(--text-primary)" }}>
                {totalBalanceSTX.toFixed(2)}
                <span className="text-xs font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>STX</span>
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Swaps done</p>
              <p className="text-lg font-bold font-data" style={{ color: "var(--text-primary)" }}>
                {totalSwapsDone}
              </p>
            </div>
          </div>

          {/* Plan list — up to 3 */}
          <div className="space-y-2">
            {(plans ?? []).slice(0, 3).map((plan) => (
              <Link
                key={plan.id}
                href="/dca"
                className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors group"
                style={{ backgroundColor: "var(--bg-elevated)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)")}
              >
                <div className="flex items-center gap-2">
                  {plan.active ? (
                    <Zap size={13} style={{ color: "var(--accent)" }} />
                  ) : (
                    <PauseCircle size={13} style={{ color: "var(--text-muted)" }} />
                  )}
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    Plan #{plan.id}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-md"
                    style={{
                      backgroundColor: plan.active ? "rgba(0,229,160,0.1)" : "var(--border-subtle)",
                      color: plan.active ? "var(--positive)" : "var(--text-muted)",
                    }}
                  >
                    {blocksToInterval(plan.ivl)}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium font-data" style={{ color: "var(--text-secondary)" }}>
                    {microToSTX(plan.amt).toFixed(2)} STX/swap
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {microToSTX(plan.bal).toFixed(2)} left
                  </p>
                </div>
              </Link>
            ))}
            {(plans ?? []).length > 3 && (
              <p className="text-xs text-center pt-1" style={{ color: "var(--text-muted)" }}>
                +{(plans ?? []).length - 3} more plans
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
