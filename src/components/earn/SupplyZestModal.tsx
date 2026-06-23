// src/components/earn/SupplyZestModal.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Bitcoin, ArrowUpRight } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { supplyZestSbtc } from "@/lib/zest";
import { trackTx } from "@/lib/tx-tracker";
import {
  sbtcToSats,
  satsToSbtc,
  validateSupplyAmount,
  estimateZTokenReceived,
} from "@/lib/domain/zest/amount";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Liquid sBTC balance in sBTC units (not sats). */
  availableSbtc: number;
}

export default function SupplyZestModal({ open, onClose, availableSbtc }: Props) {
  const t = useTranslations("earn");
  const { stxAddress, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);

  // Reset transient state each time the modal opens.
  useEffect(() => {
    if (open) { setAmount(""); setTxId(null); setLoading(false); }
  }, [open]);

  if (!open) return null;

  const availableSats = sbtcToSats(availableSbtc);
  const amt = Number(amount);
  const amountSats = Number.isFinite(amt) && amt > 0 ? sbtcToSats(amt) : 0;
  const validation = validateSupplyAmount(amountSats, availableSats);
  const estZ = satsToSbtc(estimateZTokenReceived(amountSats));

  const errorText =
    amountSats === 0
      ? null
      : validation.ok
      ? null
      : validation.reason === "below-min"
      ? t("zest.errBelowMin")
      : validation.reason === "insufficient"
      ? t("zest.errInsufficient")
      : t("zest.errZero");

  const handleSubmit = () => {
    if (!isConnected || !stxAddress) return;
    if (!validation.ok) return;
    setLoading(true);
    supplyZestSbtc(
      amountSats,
      stxAddress,
      ({ txId }) => {
        setTxId(txId);
        setLoading(false);
        addNotification(t("zest.submitted"), "info", "wallet", 5000, { txId, action: "created" });
        trackTx({
          txId,
          label: t("zest.supplyCta"),
          category: "wallet",
          context: { txId, action: "created", tokenSymbol: "sBTC", amount: String(amt) },
          addNotification,
          address: stxAddress,
        });
      },
      () => { setLoading(false); }
    );
  };

  const setMax = () => setAmount(String(availableSbtc));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="glass-card rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4" style={{ boxShadow: "var(--shadow-card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(247, 147, 26, 0.14)" }}>
              <Bitcoin size={16} style={{ color: "#F7931A" }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("zest.supplyTitle")}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} style={{ color: "var(--text-muted)" }} /></button>
        </div>

        {txId ? (
          <div className="flex flex-col gap-2">
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("zest.submitted")}</p>
            <a className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--accent)" }}
               href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
              {txId.slice(0, 10)}… <ArrowUpRight size={11} />
            </a>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{t("zest.amountLabel")}</label>
                <button className="text-[11px] font-semibold" style={{ color: "var(--accent)" }} onClick={setMax}>{t("zest.max")}</button>
              </div>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00000000"
                className="w-full rounded-xl px-3 py-2 text-sm bg-transparent border"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
              />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {t("zest.available")}: {availableSbtc.toFixed(8)} sBTC
              </p>
            </div>

            {amountSats > 0 && validation.ok && (
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                <p style={{ color: "var(--text-primary)" }}>{t("zest.receiveEst", { amount: estZ.toFixed(8) })}</p>
                <p>{t("zest.estimateNote")}</p>
              </div>
            )}

            {errorText && <p className="text-[11px]" style={{ color: "#ef4444" }}>{errorText}</p>}

            <button
              disabled={loading || !validation.ok}
              onClick={handleSubmit}
              className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#04130d" }}
            >
              {loading ? t("zest.pending") : t("zest.supplyCta")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
