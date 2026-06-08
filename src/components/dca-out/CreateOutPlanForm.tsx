"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("dca.out.form");
  const ti = useTranslations("dca.interval");
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
    if (btcToSats(amt) < 334) return t("minSwap");
    if (btcToSats(dep) < 668) return t("minDeposit");
    if (dep < amt) return t("depositGteSwap");
    if (insufficientBalance)
      return t("insufficient", { balance: sbtcBalance?.toFixed(8) ?? "0" });
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
          t("createdToast", { tx: txId.slice(0, 10) }),
          "success",
          "dca-out",
          5000,
          { txId, action: "created", amount: String(amt), tokenSymbol: "USDCx" }
        );
        onCreated();
      },
      () => {
        setLoading(false);
        addNotification(t("createFailed"), "error", "dca-out", 5000);
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
        <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("submitted")}</p>
        <p className="text-xs break-all" style={{ color: "var(--text-muted)" }}>{t("submittedTx", { txId })}</p>
        <p
          className="text-xs rounded-lg px-3 py-2"
          style={{ background: "var(--bg-elevated)", color: "var(--warning)" }}
        >
          {t("submittedHint")}
        </p>
        <button
          onClick={() => {
            setTxId(null);
            setAmountPerSwap("");
            setInitialDeposit("");
          }}
          className="mt-1 text-sm gradient-text-dca-out font-medium text-left hover:underline"
        >
          {t("createNew")}
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("heading")}</h2>

      {/* Source (sBTC) */}
      <TokenRow symbol="sBTC" colorHex="#F7931A" description={t("sbtcDesc")} rowLabel={t("tokenRowLabel", { label: t("spend") })} glyph="₿" />
      {/* Target (USDCx) */}
      <TokenRow symbol="USDCx" colorHex="#2775CA" description={t("usdcxDesc")} rowLabel={t("tokenRowLabel", { label: t("buy") })} glyph="$" />

      {/* Amount per swap */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {t("amountPerSwap")}
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
        <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{t("frequency")}</label>
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
                {ti(key)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Initial deposit */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{t("initialDeposit")}</label>
          {sbtcBalance != null && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t("balance")}{" "}
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
                {label === "Max" ? t("max") : label}
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
        {loading ? t("waitingWallet") : <>{t("createPlan")} <ArrowRight size={14} /></>}
      </button>
      <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
        {t("footnote")}
      </p>
    </div>
  );
}

function TokenRow({
  symbol,
  colorHex,
  description,
  rowLabel,
  glyph,
}: {
  symbol: string;
  colorHex: string;
  description: string;
  rowLabel: string;
  glyph?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{rowLabel}</label>
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
