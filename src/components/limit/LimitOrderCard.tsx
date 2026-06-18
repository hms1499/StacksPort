"use client";
import { useTranslations } from "next-intl";
import { microToUsd, cancelLimitOrder, type LimitOrder } from "@/lib/limit-orders";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { trackTx } from "@/lib/tx-tracker";
import { track } from "@/lib/telemetry";
import { X } from "lucide-react";

export default function LimitOrderCard({
  order,
  currentSbtcUsd,
}: {
  order: LimitOrder;
  currentSbtcUsd: number | null;
}) {
  const t = useTranslations("limit");
  const { stxAddress } = useWalletStore();
  const { addNotification } = useNotificationStore();

  const targetUsd = microToUsd(order.targetUsdMicro);
  const depositStx = order.amtMicroStx / 1_000_000;
  const distancePct =
    currentSbtcUsd && currentSbtcUsd > 0
      ? ((currentSbtcUsd - targetUsd) / currentSbtcUsd) * 100
      : null;

  function onCancel() {
    cancelLimitOrder(order.id, (data) => {
      trackTx({
        txId: data.txId,
        label: t("cancelLabel", { id: order.id }),
        category: "swap",
        addNotification,
        address: stxAddress ?? undefined,
      });
      track("limit_order_cancelled");
    });
  }

  return (
    <div className="glass-card rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          {t("buyTitle", { stx: depositStx })}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {t("targetLine", { usd: targetUsd.toLocaleString() })}
          {distancePct !== null && ` · ${distancePct > 0 ? "+" : ""}${distancePct.toFixed(1)}%`}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="p-2 rounded-lg"
        style={{ color: "var(--text-muted)" }}
        aria-label={t("cancelAria")}
      >
        <X size={16} />
      </button>
    </div>
  );
}
