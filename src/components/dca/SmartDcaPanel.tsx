"use client";
import { useState } from "react";
import { useSmartDcaStore } from "@/store/smartDcaStore";
import { saveSmartDca, removeSmartDca, useSmartDcaSignal } from "@/hooks/useSmartDca";

interface Props {
  planId: number;
  address: string;
  vaultType: 0 | 1; // only vault 0 supports Smart DCA in v1
}

export function SmartDcaPanel({ planId, address, vaultType }: Props) {
  const cfg = useSmartDcaStore((s) => s.configs[planId]);
  const enabled = !!cfg;
  const [thresholdPct, setThresholdPct] = useState(cfg ? cfg.thresholdBps / 100 : 5);
  const [windowDays, setWindowDays] = useState(cfg?.windowDays ?? 7);
  const [maxDefer, setMaxDefer] = useState(cfg?.maxDeferIntervals ?? 2);
  const [error, setError] = useState<string | null>(null);

  const signal = useSmartDcaSignal(windowDays, enabled);

  if (vaultType !== 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Smart DCA (buy the dip) is available on STX→sBTC plans.
      </p>
    );
  }

  async function onSave() {
    setError(null);
    const r = await saveSmartDca({
      address, planId,
      thresholdBps: Math.round(thresholdPct * 100),
      windowDays, maxDeferIntervals: maxDefer,
    });
    if (!r.ok) setError(r.details?.join(", ") ?? "Save failed");
  }

  const pct = signal?.premium != null ? (signal.premium * 100).toFixed(1) : null;
  const need = thresholdPct.toFixed(1);

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{ border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Smart DCA — buy the dip
        </span>
        {enabled && (
          <button
            className="text-xs font-medium"
            style={{ color: "var(--negative)" }}
            onClick={() => removeSmartDca(address, planId)}
          >
            Turn off
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>
          Buy only when 1 STX gets ≥ this % more sats than the {windowDays}-day average
        </span>
        <input
          type="number"
          min={0}
          max={50}
          step={0.5}
          value={thresholdPct}
          onChange={(e) => setThresholdPct(Number(e.target.value))}
          className="w-24 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>Average window (days)</span>
        <input
          type="number"
          min={1}
          max={30}
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="w-24 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>Max checks to skip before buying at market</span>
        <input
          type="number"
          min={0}
          max={10}
          value={maxDefer}
          onChange={(e) => setMaxDefer(Number(e.target.value))}
          className="w-24 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        />
      </label>

      {enabled && pct != null && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Now: {pct}% vs average — need ≥ {need}%.
          {Number(pct) >= Number(need) ? " Dip condition met." : " Waiting for a better entry."}
        </p>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--negative)" }}>
          {error}
        </p>
      )}

      <button
        className="self-start rounded-xl px-3 py-1.5 text-xs font-medium"
        style={{ background: "var(--accent)", color: "#fff" }}
        onClick={onSave}
      >
        {enabled ? "Update" : "Enable Smart DCA"}
      </button>
    </div>
  );
}
