"use client";

import { useState, useEffect } from "react";
import { PlusCircle, ArrowRight } from "lucide-react";
import { createPlan, INTERVALS, stxToMicro, microToSTX, TARGET_TOKENS, getSTXBalance } from "@/lib/dca";
import { quoteSbtcForUstx, netUstxAfterFee } from "@/lib/dca-quote";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import LivePreviewCard from "./LivePreviewCard";

const SBTC = TARGET_TOKENS[0].value;
const AMOUNT_PRESETS = [10, 50, 100];
const DEPOSIT_PERCENTS: Array<{ label: string; pct: number }> = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.50 },
  { label: "Max", pct: 1.00 },
];

interface Props {
  onCreated: () => void;
}

export default function CreatePlanForm({ onCreated }: Props) {
  const { stxAddress } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [amountPerSwap, setAmountPerSwap] = useState("");
  const [interval, setInterval] = useState<keyof typeof INTERVALS>("Weekly");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [stxBalance, setStxBalance] = useState<number | null>(null);
  const [estSbtc, setEstSbtc] = useState<number | null>(null);

  useEffect(() => {
    if (!stxAddress) return;
    getSTXBalance(stxAddress).then((bal) => setStxBalance(microToSTX(bal)));
  }, [stxAddress]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { amount, interval: intv, deposit } = (e as CustomEvent).detail;
      setAmountPerSwap(amount);
      setInterval(intv as keyof typeof INTERVALS);
      setInitialDeposit(deposit);
    };
    window.addEventListener("dca:fill-form", handler);
    return () => window.removeEventListener("dca:fill-form", handler);
  }, []);

  const amt = parseFloat(amountPerSwap) || 0;
  const dep = parseFloat(initialDeposit) || 0;
  const maxDeposit = stxBalance != null ? Math.max(0, Math.floor((stxBalance - 0.01) * 100) / 100) : 0;
  const insufficientBalance = stxBalance != null && dep > stxBalance;

  useEffect(() => {
    if (amt < 1) { setEstSbtc(null); return; }
    const net = netUstxAfterFee(stxToMicro(amt));
    let cancelled = false;
    quoteSbtcForUstx(net)
      .then((v) => { if (!cancelled) setEstSbtc(v); })
      .catch(() => { if (!cancelled) setEstSbtc(null); });
    return () => { cancelled = true; };
  }, [amt]);

  const validate = (): string | null => {
    if (amt < 1) return "Minimum 1 STX per swap";
    if (dep < 2) return "Minimum deposit 2 STX";
    if (dep < amt) return "Initial deposit must be ≥ amount per swap";
    if (insufficientBalance) return `Insufficient STX. Current balance: ${stxBalance?.toFixed(2)} STX`;
    return null;
  };
  const invalid = validate();

  const handleSubmit = () => {
    const err = validate();
    if (err) { addNotification(err, "error", "dca", 5000); return; }
    setLoading(true);
    createPlan(
      SBTC,
      stxToMicro(amt),
      INTERVALS[interval],
      stxToMicro(dep),
      ({ txId }) => {
        setTxId(txId);
        setLoading(false);
        addNotification(
          `Plan created! Tx: ${txId.slice(0, 10)}...`,
          "success", "dca", 5000,
          { txId, action: "created", amount: String(amt), tokenSymbol: "sBTC" },
        );
        onCreated();
      },
      () => {
        setLoading(false);
        addNotification("Failed to create plan", "error", "dca", 5000);
      },
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
          onClick={() => { setTxId(null); setAmountPerSwap(""); setInitialDeposit(""); }}
          className="mt-1 text-sm gradient-text-dca-in font-medium text-left hover:underline"
        >
          + Create new plan
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Create DCA Plan</h2>

      {/* Source (STX) */}
      <TokenRow symbol="STX" colorHex="#F7931A" description="Native Stacks token" label="Spend" />
      {/* Target (sBTC) */}
      <TokenRow symbol="sBTC" colorHex="#F7931A" description="Bitcoin on Stacks" label="Buy" glyph="₿" />

      {/* Amount per swap */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Amount per Swap</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={amountPerSwap}
              onChange={(e) => setAmountPerSwap(e.target.value)}
              placeholder="1"
              min="1"
              className="w-full px-3 py-2.5 pr-14 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{
                border: "1px solid var(--border-default)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>STX</span>
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
          {(Object.keys(INTERVALS) as (keyof typeof INTERVALS)[]).map((key) => {
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
          {stxBalance != null && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Balance:{" "}
              <span style={{ color: insufficientBalance ? "var(--negative)" : "var(--text-secondary)", fontWeight: 500 }}>
                {stxBalance.toFixed(2)} STX
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
              placeholder="2"
              min="2"
              className="w-full px-3 py-2.5 pr-14 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{
                border: `1px solid ${insufficientBalance ? "var(--negative)" : "var(--border-default)"}`,
                background: insufficientBalance ? "var(--bg-elevated)" : "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>STX</span>
          </div>
          <div className="flex gap-1">
            {DEPOSIT_PERCENTS.map(({ label, pct }) => (
              <button
                key={label}
                type="button"
                disabled={stxBalance == null}
                onClick={() => setInitialDeposit((maxDeposit * pct).toFixed(2))}
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
        mode="in"
        amountStx={amt}
        depositStx={dep}
        intervalKey={interval}
        estimatedOutput={estSbtc != null && amt > 0 ? estSbtc : null}
        outputLabel="sBTC"
        inputLabel="STX"
        invalidReason={amt > 0 && dep > 0 ? invalid : null}
      />

      <button
        onClick={handleSubmit}
        disabled={loading || !!invalid}
        className="gradient-dca-in w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:brightness-110"
      >
        {loading ? "Waiting for wallet…" : <>Create Plan <ArrowRight size={14} /></>}
      </button>
      <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
        Mainnet · 0.3% protocol fee per swap
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
