"use client";

import { useState, useEffect } from "react";
import { PlusCircle, ArrowRight } from "lucide-react";
import {
  createSBTCPlan,
  SBTC_INTERVALS,
  btcToSats,
  satsToBTC,
  SBTC_TARGET_TOKENS,
  getSBTCBalance,
} from "@/lib/dca-sbtc";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import LivePreviewCard from "../dca/LivePreviewCard";

const USDCX = SBTC_TARGET_TOKENS[0].value;
const AMOUNT_PRESETS = [0.001, 0.005, 0.01]; // sBTC per swap
const DEPOSIT_PERCENTS: Array<{ label: string; pct: number }> = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.50 },
  { label: "Max", pct: 1.00 },
];

interface Props {
  onCreated: () => void;
}

export default function CreateOutPlanForm({ onCreated }: Props) {
  const { stxAddress } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [amountPerSwap, setAmountPerSwap] = useState("");
  const [interval, setInterval] = useState<keyof typeof SBTC_INTERVALS>("Weekly");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [sbtcBalance, setSbtcBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!stxAddress) return;
    getSBTCBalance(stxAddress).then((sats) => setSbtcBalance(satsToBTC(sats)));
  }, [stxAddress]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { amount, interval: intv, deposit } = (e as CustomEvent).detail;
      setAmountPerSwap(amount);
      setInterval(intv as keyof typeof SBTC_INTERVALS);
      setInitialDeposit(deposit);
    };
    window.addEventListener("dca-out:fill-form", handler);
    return () => window.removeEventListener("dca-out:fill-form", handler);
  }, []);

  const amt = parseFloat(amountPerSwap) || 0;
  const dep = parseFloat(initialDeposit) || 0;
  const maxDeposit = sbtcBalance != null ? Math.max(0, Math.floor(sbtcBalance * 1e8 - 1) / 1e8) : 0;
  const insufficientBalance = sbtcBalance != null && dep > sbtcBalance;

  const validate = (): string | null => {
    if (btcToSats(amt) < 334) return "Minimum 334 satoshis per swap (0.00000334 sBTC)";
    if (btcToSats(dep) < 668) return "Minimum deposit 668 satoshis";
    if (dep < amt) return "Initial deposit must be ≥ amount per swap";
    if (insufficientBalance)
      return `Insufficient sBTC. Current balance: ${sbtcBalance?.toFixed(8)} sBTC`;
    return null;
  };
  const invalid = validate();

  const handleSubmit = () => {
    const err = validate();
    if (err) {
      addNotification(err, "error", "dca-out", 5000);
      return;
    }
    setLoading(true);

    createSBTCPlan(
      USDCX,
      btcToSats(amt),
      SBTC_INTERVALS[interval],
      btcToSats(dep),
      ({ txId }) => {
        setTxId(txId);
        setLoading(false);
        addNotification(
          `Plan created! Tx: ${txId.slice(0, 10)}...`,
          "success",
          "dca-out",
          5000,
          { txId, action: "created", amount: String(amt), tokenSymbol: "USDCx" }
        );
        onCreated();
      },
      () => {
        setLoading(false);
        addNotification("Failed to create plan", "error", "dca-out", 5000);
      }
    );
  };

  if (txId) {
    return (
      <div className="glass-card rounded-2xl p-5 flex flex-col gap-3" style={{ boxShadow: "var(--shadow-card)" }}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "var(--accent-dim)" }}
        >
          <PlusCircle size={18} style={{ color: "var(--accent)" }} />
        </div>
        <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Plan submitted!</p>
        <p className="text-xs break-all" style={{ color: "var(--text-muted)" }}>Tx: {txId}</p>
        <p
          className="text-xs rounded-lg px-3 py-2"
          style={{ background: "var(--bg-elevated)", color: "var(--warning)" }}
        >
          Plan will appear after the transaction is confirmed (~1-2 min). Click refresh to update.
        </p>
        <button
          onClick={() => {
            setTxId(null);
            setAmountPerSwap("");
            setInitialDeposit("");
          }}
          className="mt-1 text-sm gradient-text-dca-out font-medium text-left hover:underline"
        >
          + Create new plan
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Create DCA Out Plan</h2>

      {/* Source (sBTC) */}
      <TokenRow symbol="sBTC" colorHex="#F7931A" description="Bitcoin on Stacks" label="Spend" glyph="₿" />
      {/* Target (USDCx) */}
      <TokenRow symbol="USDCx" colorHex="#2775CA" description="USD Coin on Stacks" label="Buy" glyph="$" />

      {/* Amount per swap */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Amount per Swap
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={amountPerSwap}
              onChange={(e) => setAmountPerSwap(e.target.value)}
              placeholder="0.001"
              step="0.00000001"
              min="0.00000334"
              className="w-full px-3 py-2.5 pr-16 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{
                border: "1px solid var(--border-default)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>sBTC</span>
          </div>
          <div className="flex gap-1">
            {AMOUNT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmountPerSwap(String(p))}
                className="px-2 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interval chips */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Frequency</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SBTC_INTERVALS) as (keyof typeof SBTC_INTERVALS)[]).map((key) => {
            const active = interval === key;
            return (
              <button
                key={key}
                onClick={() => setInterval(key)}
                className="py-2 rounded-xl text-sm font-medium transition-all"
                style={
                  active
                    ? { background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)" }
                    : { border: "1px solid var(--border-default)", color: "var(--text-secondary)", background: "var(--bg-card)" }
                }
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>

      {/* Initial deposit */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Initial Deposit</label>
          {sbtcBalance != null && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Balance:{" "}
              <span style={{ color: insufficientBalance ? "var(--negative)" : "var(--text-secondary)", fontWeight: 500 }}>
                {sbtcBalance.toFixed(8)} sBTC
              </span>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(e.target.value)}
              placeholder="0.00000668"
              step="0.00000001"
              min="0.00000668"
              className="w-full px-3 py-2.5 pr-16 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{
                border: `1px solid ${insufficientBalance ? "var(--negative)" : "var(--border-default)"}`,
                background: insufficientBalance ? "var(--bg-elevated)" : "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>sBTC</span>
          </div>
          <div className="flex gap-1">
            {DEPOSIT_PERCENTS.map(({ label, pct }) => (
              <button
                key={label}
                type="button"
                disabled={sbtcBalance == null}
                onClick={() => setInitialDeposit((maxDeposit * pct).toFixed(8))}
                className="px-2 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                style={{
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <LivePreviewCard
        mode="out"
        amountStx={amt}
        depositStx={dep}
        intervalKey={interval as never}
        estimatedOutput={null}
        outputLabel="USDCx"
        inputLabel="sBTC"
        invalidReason={amt > 0 && dep > 0 ? invalid : null}
      />

      <button
        onClick={handleSubmit}
        disabled={loading || !!invalid}
        className="gradient-dca-out w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:brightness-110"
      >
        {loading ? "Waiting for wallet…" : <>Create Plan <ArrowRight size={14} /></>}
      </button>
      <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
        Mainnet · 0.3% protocol fee per swap · 3-hop swap via Bitflow
      </p>
    </div>
  );
}

function TokenRow({
  symbol,
  colorHex,
  description,
  label,
  glyph,
}: {
  symbol: string;
  colorHex: string;
  description: string;
  label: string;
  glyph?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label} (Source Token)</label>
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ background: colorHex }}
        >
          {glyph ?? symbol[0]}
        </span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{symbol}</span>
        <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{description}</span>
      </div>
    </div>
  );
}
