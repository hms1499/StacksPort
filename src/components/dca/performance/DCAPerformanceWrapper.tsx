"use client";

import dynamic from "next/dynamic";

const DCAPerformanceContent = dynamic(() => import("./DCAPerformanceContent"), {
  ssr: false,
  loading: () => (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="h-8 w-48 bg-[var(--bg-elevated)] rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-[var(--bg-elevated)] rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-[var(--bg-elevated)] rounded-2xl animate-pulse" />
    </div>
  ),
});

export default function DCAPerformanceWrapper() {
  return <DCAPerformanceContent />;
}
