"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * Route-level error boundary. Catches render/data errors in any page segment
 * and lets the user retry (`reset`) without a full reload. The root layout —
 * and therefore the sidebar — stays mounted around this.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5 p-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: "rgba(239,68,68,0.10)" }}
      >
        <AlertTriangle size={26} style={{ color: "rgb(239,68,68)" }} />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Something went wrong
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          This section failed to load. You can retry, or head back to your
          dashboard.
        </p>
        {error.digest && (
          <p className="text-[11px] font-mono pt-1" style={{ color: "var(--text-muted)" }}>
            Ref: {error.digest}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <RefreshCw size={14} /> Try again
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          <Home size={14} /> Dashboard
        </Link>
      </div>
    </div>
  );
}
