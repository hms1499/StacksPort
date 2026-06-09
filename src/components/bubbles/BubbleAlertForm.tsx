"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, Bell, X } from "lucide-react";
import { usePriceAlertStore } from "@/store/priceAlertStore";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import type { PriceAlertCondition } from "@/types/priceAlerts";

interface Props {
  symbol: string;
  geckoId: string;
  currentPrice: number;
}

function fmtTarget(v: number): string {
  return v.toFixed(v >= 1 ? 2 : 6);
}

export default function BubbleAlertForm({ symbol, geckoId, currentPrice }: Props) {
  const t = useTranslations("bubbles.alert");
  const addAlert = usePriceAlertStore((s) => s.addAlert);
  const removeAlert = usePriceAlertStore((s) => s.removeAlert);
  const existingAlerts = usePriceAlertStore((s) =>
    s.alerts.filter((a) => a.geckoId === geckoId)
  );
  const totalAlerts = usePriceAlertStore((s) => s.alerts.length);

  const { permission, isSupported, subscribe } = usePushNotifications();
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const showPushPrompt =
    !pushPromptDismissed && isSupported && permission !== "granted" && totalAlerts >= 1;

  const inputRef = useRef<HTMLInputElement>(null);
  const [condition, setCondition] = useState<PriceAlertCondition>("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [error, setError] = useState("");

  const parsed = parseFloat(targetPrice);
  const isValid = !isNaN(parsed) && parsed > 0;

  const handleEnablePush = async () => {
    setSubscribing(true);
    try {
      await subscribe();
    } finally {
      setSubscribing(false);
      setPushPromptDismissed(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError(t("enterPrice"));
      return;
    }
    setError("");
    addAlert(symbol, geckoId, condition, parsed);
    setTargetPrice("");
  };

  return (
    <div className="space-y-2.5">
      {existingAlerts.length > 0 && (
        <div className="space-y-1">
          {existingAlerts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 px-2 py-1 rounded-md text-[11px]"
              style={{ backgroundColor: "var(--bg-elevated)" }}
            >
              <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                {a.condition === "above" ? (
                  <TrendingUp size={11} className="text-green-500" />
                ) : (
                  <TrendingDown size={11} className="text-red-500" />
                )}
                {a.condition === "above" ? t("above") : t("below")} ${a.targetPrice.toLocaleString()}
                <span
                  className={`ml-1 px-1 py-0.5 rounded text-[9px] ${
                    a.isActive
                      ? "bg-green-500/10 text-green-600"
                      : "bg-gray-500/10 text-gray-500"
                  }`}
                >
                  {a.isActive ? t("active") : t("triggered")}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeAlert(a.id)}
                aria-label={t("deleteAria", { condition: a.condition === "above" ? t("above") : t("below"), price: a.targetPrice })}
                className="p-0.5 rounded hover:bg-white/5"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setCondition("above")}
            className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
              condition === "above"
                ? "border-green-500 bg-green-500/10 text-green-600"
                : "border-transparent hover:bg-white/5"
            }`}
            style={condition !== "above" ? { color: "var(--text-secondary)" } : undefined}
          >
            <TrendingUp size={12} /> {t("above")}
          </button>
          <button
            type="button"
            onClick={() => setCondition("below")}
            className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
              condition === "below"
                ? "border-red-500 bg-red-500/10 text-red-500"
                : "border-transparent hover:bg-white/5"
            }`}
            style={condition !== "below" ? { color: "var(--text-secondary)" } : undefined}
          >
            <TrendingDown size={12} /> {t("below")}
          </button>
        </div>

        {currentPrice > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {t("quick")}
            </span>
            <button
              type="button"
              onClick={() => {
                setTargetPrice(fmtTarget(currentPrice * 1.05));
                setCondition("above");
                setError("");
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium border"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
            >
              +5%
            </button>
            <button
              type="button"
              onClick={() => {
                setTargetPrice(fmtTarget(currentPrice * 0.95));
                setCondition("below");
                setError("");
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium border"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
            >
              -5%
            </button>
          </div>
        )}

        <div className="relative">
          <span
            className="absolute left-2 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            $
          </span>
          <input
            ref={inputRef}
            type="number"
            step="any"
            min="0"
            placeholder={t("targetPrice")}
            value={targetPrice}
            onChange={(e) => {
              setTargetPrice(e.target.value);
              if (error) setError("");
            }}
            className="w-full pl-5 pr-2 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--bg-elevated)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        {error && <p className="text-[11px] text-red-500">{error}</p>}

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#408A71" }}
        >
          <Bell size={13} /> {t("createAlert")}
        </button>
      </form>

      {showPushPrompt && (
        <div
          className="pt-2 border-t flex items-start gap-1.5"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <Bell size={12} className="mt-0.5 shrink-0" style={{ color: "#408A71" }} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] leading-snug" style={{ color: "var(--text-secondary)" }}>
              {t("pushPrompt")}
            </p>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={subscribing}
                className="text-[10px] font-medium disabled:opacity-50"
                style={{ color: "#408A71" }}
              >
                {subscribing ? t("enabling") : t("enable")}
              </button>
              <button
                type="button"
                onClick={() => setPushPromptDismissed(true)}
                className="text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                {t("dismiss")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
