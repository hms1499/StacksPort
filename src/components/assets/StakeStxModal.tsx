// src/components/assets/StakeStxModal.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Lock, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { stakeStx, fetchStxPerStStx } from "@/lib/stacking-dao";
import { trackTx } from "@/lib/tx-tracker";
import { stxToMicro, microToSTX } from "@/lib/dca";
import { idleStx, validateStakeAmount, estimateStStxReceived } from "@/lib/domain/stacking/amount";
import { MIN_STAKE_USTX } from "@/lib/domain/stacking/contracts";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Liquid (unlocked) STX balance in STX units. */
  availableStx: number;
  /** Current stSTX position in STX-equivalent units (0 if none). */
  stStxStakedStx?: number;
}

export default function StakeStxModal({ open, onClose, availableStx, stStxStakedStx = 0 }: Props) {
  const t = useTranslations("assets.stake");
  const { stxAddress, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);

  // Best-effort exchange rate for the "you'll receive" estimate.
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchStxPerStStx().then((r) => { if (active) setRate(r); });
    return () => { active = false; };
  }, [open]);

  // Reset transient state each time the modal opens.
  useEffect(() => {
    if (open) { setAmount(""); setTxId(null); setLoading(false); }
  }, [open]);

  if (!open) return null;

  const availableUstx = idleStx(stxToMicro(availableStx));
  const amt = Number(amount);
  const amountUstx = Number.isFinite(amt) && amt > 0 ? stxToMicro(amt) : 0;
  const validation = validateStakeAmount(amountUstx, availableUstx);
  const estStStx = rate ? microToSTX(estimateStStxReceived(amountUstx, rate)) : null;

  const errorText =
    amountUstx === 0
      ? null
      : validation.ok
      ? null
      : validation.reason === "below-min"
      ? t("minError", { min: MIN_STAKE_USTX / 1_000_000 })
      : t("balanceError");

  const handleSubmit = () => {
    if (!isConnected || !stxAddress) { addNotification(t("connectFirst"), "error", "wallet", 5000); return; }
    if (!validation.ok) return;
    setLoading(true);
    stakeStx(
      amountUstx,
      stxAddress,
      ({ txId }) => {
        setTxId(txId);
        setLoading(false);
        addNotification(t("submittedTitle"), "info", "wallet", 5000, { txId, action: "created" });
        trackTx({
          txId,
          label: t("txLabel"),
          category: "wallet",
          context: { txId, action: "created", tokenSymbol: "stSTX", amount: String(amt) },
          addNotification,
          address: stxAddress,
        });
      },
      () => { setLoading(false); }
    );
  };

  const setMax = () => setAmount(String(microToSTX(availableUstx)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="glass-card rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4" style={{ boxShadow: "var(--shadow-card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
              <Lock size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("title")}</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t("subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} style={{ color: "var(--text-muted)" }} /></button>
        </div>

        {txId ? (
          <div className="flex flex-col gap-2">
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("submittedTitle")}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("submittedDesc")}</p>
            <a className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--accent)" }}
               href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
              {txId.slice(0, 10)}… <ArrowUpRight size={11} />
            </a>
          </div>
        ) : (
          <>
            {stStxStakedStx > 0 && (
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {t("currentPosition", { amount: stStxStakedStx.toFixed(2) })}
              </p>
            )}

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{t("amountLabel")}</label>
                <button className="text-[11px] font-semibold" style={{ color: "var(--accent)" }} onClick={setMax}>{t("max")}</button>
              </div>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-full rounded-xl px-3 py-2 text-sm bg-transparent border"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
              />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {t("balance", { balance: microToSTX(availableUstx).toFixed(2) })}
              </p>
            </div>

            {estStStx !== null && amountUstx > 0 && validation.ok && (
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                <p style={{ color: "var(--text-primary)" }}>{t("estReceive", { amount: estStStx.toFixed(2) })}</p>
                <p>{t("estNote")}</p>
              </div>
            )}

            {errorText && <p className="text-[11px]" style={{ color: "#ef4444" }}>{errorText}</p>}

            <button
              disabled={loading || !validation.ok}
              onClick={handleSubmit}
              className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#04130d" }}
            >
              {loading ? t("submitting") : t("submit")}
            </button>

            {stStxStakedStx > 0 && (
              <Link href="/trade" className="text-[11px] font-semibold text-center flex items-center justify-center gap-1" style={{ color: "var(--text-muted)" }}>
                {t("unstake")} <ArrowUpRight size={11} />
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
