"use client";

import dynamic from "next/dynamic";

const AIPageContent = dynamic(() => import("./AIPageContent"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col min-h-screen">
      <div className="h-14" style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }} />
      <div className="flex-1 p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`glass-card rounded-2xl p-5 shadow-sm animate-pulse ${i >= 2 ? "lg:col-span-2" : ""}`}
            >
              <div className="h-5 rounded w-1/3 mb-4" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="space-y-3">
                <div className="h-4 rounded w-full" style={{ backgroundColor: 'var(--bg-elevated)' }} />
                <div className="h-4 rounded w-2/3" style={{ backgroundColor: 'var(--bg-elevated)' }} />
                <div className="h-4 rounded w-3/4" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
});

export default function AIPageWrapper() {
  return <AIPageContent />;
}
