"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  validateLimitOrder, usdToMicro, createLimitOrder, SBTC_TOKEN,
} from "@/lib/limit-orders";
import { useLimitOrders } from "@/hooks/usePortfolioSnapshot";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { trackTx } from "@/lib/tx-tracker";
import { track } from "@/lib/telemetry";

export default function CreateLimitOrderForm() {
  const t = useTranslations("limit");
  const { stxAddress, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { openCount } = useLimitOrders(addr);
  const [depositStx, setDepositStx] = useState("");
  const [targetUsd, setTargetUsd] = useState("");

  const deposit = parseFloat(depositStx) || 0;
  const target = parseFloat(targetUsd) || 0;
  const { ok, errors } = validateLimitOrder({ depositStx: deposit, targetUsd: target, openOrderCount: openCount });

  function onSubmit() {
    if (!ok || !isConnected) return;
    createLimitOrder(
      SBTC_TOKEN,
      Math.round(deposit * 1_000_000),
      usdToMicro(target),
      (data) => {
        trackTx({
          txId: data.txId,
          label: t("createLabel"),
          category: "swap",
          addNotification,
          address: stxAddress ?? undefined,
        });
        track("limit_order_created");
        setDepositStx("");
        setTargetUsd("");
      }
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs" style={{ color: "var(--text-secondary)" }}>
        {t("depositLabel")}
        <input
          inputMode="decimal" value={depositStx} onChange={(e) => setDepositStx(e.target.value)}
          placeholder="2.0"
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
        />
      </label>
      <label className="block text-xs" style={{ color: "var(--text-secondary)" }}>
        {t("targetLabel")}
        <input
          inputMode="decimal" value={targetUsd} onChange={(e) => setTargetUsd(e.target.value)}
          placeholder="60000"
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
        />
      </label>
      {!ok && depositStx !== "" && (
        <p className="text-xs" style={{ color: "var(--negative)" }}>{errors[0]}</p>
      )}
      <button
        onClick={onSubmit}
        disabled={!ok || !isConnected}
        className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)" }}
      >
        {isConnected ? t("submit") : t("connectFirst")}
      </button>
    </div>
  );
}
