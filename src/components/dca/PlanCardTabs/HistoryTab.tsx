"use client";

import { History } from "lucide-react";

export default function HistoryTab() {
  return (
    <div className="rounded-xl p-6 flex flex-col items-center gap-2 text-center" style={{ background: "var(--bg-elevated)" }}>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: "var(--accent-dim)" }}
      >
        <History size={18} style={{ color: "var(--accent)" }} />
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        History coming soon
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        We&apos;ll show each past swap here once the indexer is wired up.
      </p>
    </div>
  );
}
