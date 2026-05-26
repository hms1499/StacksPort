"use client";

import dynamic from "next/dynamic";

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

export default function DashboardGridClient() {
  return <DashboardGrid />;
}
