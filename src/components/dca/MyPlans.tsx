"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";
import { getUserPlans, type DCAPlan } from "@/lib/dca";
import PlanCard from "./PlanCard";

interface Props {
  address: string;
}

const PRESETS = [
  { label: "10 STX weekly",    amount: "10",  interval: "Weekly",  deposit: "50"  },
  { label: "50 STX monthly",   amount: "50",  interval: "Monthly", deposit: "200" },
];

function fireFillForm(p: typeof PRESETS[number]) {
  window.dispatchEvent(new CustomEvent("dca:fill-form", { detail: p }));
}

export default function MyPlans({ address }: Props) {
  const [plans, setPlans] = useState<DCAPlan[] | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [userPlans, blockRes] = await Promise.all([
        getUserPlans(address),
        fetch("https://api.hiro.so/v2/info").then((r) => r.json()),
      ]);
      setPlans(userPlans);
      setCurrentBlock(blockRes?.stacks_tip_height ?? 0);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch plans:", err);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
        My Plans
        {plans && plans.length > 0 && (
          <span
            className="ml-2 text-xs font-medium rounded-full px-2 py-0.5"
            style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
          >
            {plans.length}
          </span>
        )}
      </h2>
      <div className="flex items-center gap-2">
        {lastUpdated && !loading && (
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
          </span>
        )}
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 rounded-xl transition-colors disabled:opacity-40"
          style={{ color: "var(--text-muted)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );

  if (plans === null) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="glass-card rounded-2xl h-20 animate-pulse"
              style={{ boxShadow: "var(--shadow-card)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div
          className="glass-card rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--accent-dim)" }}
          >
            <Inbox size={22} style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>No plans yet</p>
          <p className="text-xs max-w-xs" style={{ color: "var(--text-muted)" }}>
            Create your first DCA plan on the left to start auto-buying sBTC.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => fireFillForm(p)}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--border-subtle)" }}
              >
                Try: {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="flex flex-col gap-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentBlock={currentBlock}
            onRefresh={fetchData}
            isExpanded={expandedId === plan.id}
            onToggle={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
          />
        ))}
      </div>
    </div>
  );
}
