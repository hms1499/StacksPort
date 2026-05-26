"use client";

import { useWalletStore } from "@/store/walletStore";
import { usePriceAlertStore } from "@/store/priceAlertStore";
import { useUserDCAPlans } from "@/hooks/useMarketData";
import {
  WIDGETS,
  type RequiresTag,
  type WidgetId,
} from "@/components/dashboard/widget-registry";

/**
 * Returns the set of grid widget ids that should actually render right now.
 *
 * Reads stores/hooks to compute the session's capability tags, then filters
 * the registry: a widget is visible iff every tag in its `requires` is
 * present. Adding a new conditional widget is one entry in the registry —
 * adding a new condition type means teaching this hook one new tag.
 *
 * RGL keeps the persisted layout intact — when a widget reappears (eg. after
 * wallet connect), it pops back at its saved position.
 */
export function useDashboardVisibility(): Set<WidgetId> {
  const { isConnected, stxAddress } = useWalletStore();
  const alertsTotal = usePriceAlertStore((s) => s.alerts.length);
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: plans } = useUserDCAPlans(addr);

  const totalSwapsDone = (plans ?? []).reduce((sum, p) => sum + p.tsd, 0);

  const capabilities = new Set<RequiresTag>();
  if (isConnected) capabilities.add("wallet");
  if (alertsTotal > 0) capabilities.add("alerts");
  if (isConnected && totalSwapsDone > 0) capabilities.add("dcaExecuted");

  const visible = new Set<WidgetId>();
  for (const w of WIDGETS) {
    if (!w.requires || w.requires.every((r) => capabilities.has(r))) {
      visible.add(w.id);
    }
  }
  return visible;
}
