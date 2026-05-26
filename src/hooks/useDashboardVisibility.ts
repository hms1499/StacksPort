"use client";

import { useWalletStore } from "@/store/walletStore";
import { usePriceAlertStore } from "@/store/priceAlertStore";
import { useUserDCAPlans } from "@/hooks/useMarketData";
import type { WidgetId } from "@/hooks/useDashboardLayout";

/**
 * Returns the set of grid widget ids that should actually render right now.
 * RGL keeps the persisted layout intact — when a widget reappears (eg. after
 * wallet connect), it pops back at its saved position.
 */
export function useDashboardVisibility(): Set<WidgetId> {
  const { isConnected, stxAddress } = useWalletStore();
  const alertsTotal = usePriceAlertStore((s) => s.alerts.length);
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: plans } = useUserDCAPlans(addr);

  const totalSwapsDone = (plans ?? []).reduce((sum, p) => sum + p.tsd, 0);

  const visible = new Set<WidgetId>([
    "balance",
    "stx-stats",
    "pox-cycle",
    "greed",
    "trending",
    "news",
    "activity",
  ]);
  if (isConnected) {
    visible.add("quick-actions");
    visible.add("dca-summary");
  }
  if (alertsTotal > 0) visible.add("alerts");
  if (isConnected && totalSwapsDone > 0) visible.add("dca-perf");

  return visible;
}
