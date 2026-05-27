"use client";

import dynamic from "next/dynamic";
import { SWRConfig } from "swr";
import type { MarketSnapshot } from "@/lib/server/market-snapshot";

const DashboardGrid = dynamic(() => import("@/components/dashboard/DashboardGrid"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-5 shadow-sm">
          <div className="h-4 w-32 rounded skeleton mb-4" />
          <div className="h-24 rounded-xl skeleton" />
        </div>
      ))}
    </div>
  ),
});

interface Props {
  marketSnapshot?: MarketSnapshot;
}

export default function DashboardGridClient({ marketSnapshot }: Props) {
  // Seeds the SWR cache for `useMarketSnapshot()` so consumers render with
  // server-fetched data on first paint. The key must match SNAPSHOT_KEY in
  // useMarketSnapshot.ts ("market-snapshot").
  const fallback = marketSnapshot
    ? { "market-snapshot": marketSnapshot }
    : {};

  return (
    <SWRConfig value={{ fallback }}>
      <DashboardGrid />
    </SWRConfig>
  );
}
