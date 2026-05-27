"use client";

import { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { usePriceAlertStore } from "@/store/priceAlertStore";
import { PRICE_ALERT_TOKENS, type PriceAlertCondition } from "@/types/priceAlerts";
import type { TokenWithValue } from "@/lib/stacks";

interface Props {
  token: TokenWithValue;
  currentPrice: number;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export default function AlertPopover({ token, currentPrice, open, onClose, anchorRef }: Props) {
  const addAlert = usePriceAlertStore((s) => s.addAlert);

  const [condition, setCondition] = useState<PriceAlertCondition>("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [error, setError] = useState("");

  const geckoId = PRICE_ALERT_TOKENS.find((t) => t.symbol === token.symbol)?.geckoId;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const popover = document.getElementById("alert-popover-root");
      if (popover?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose, anchorRef]);

  if (!open || !geckoId) return null;

  const parsed = parseFloat(targetPrice);
  const isValid = !isNaN(parsed) && parsed > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError("Please enter a valid price greater than 0");
      return;
    }
    setError("");
    addAlert(token.symbol, geckoId, condition, parsed);
    setTargetPrice("");
  };

  return (
    <div
      id="alert-popover-root"
      role="dialog"
      aria-modal="false"
      aria-labelledby="alert-popover-title"
      className="absolute right-4 bottom-24 z-50 w-[calc(100%-32px)] sm:w-80 rounded-2xl shadow-2xl border p-4"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 id="alert-popover-title" className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Set price alert — {token.symbol}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close price alert"
          className="p-1 rounded transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
        >
          <X size={14} />
        </button>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Current: ${currentPrice.toLocaleString()}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCondition("above")}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
              condition === "above" ? "border-green-500 bg-green-50 text-green-700" : "border-transparent hover:bg-gray-50"
            }`}
            style={condition !== "above" ? { color: "var(--text-secondary)" } : undefined}
          >
            <TrendingUp size={14} /> Above
          </button>
          <button
            type="button"
            onClick={() => setCondition("below")}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
              condition === "below" ? "border-red-500 bg-red-50 text-red-700" : "border-transparent hover:bg-gray-50"
            }`}
            style={condition !== "below" ? { color: "var(--text-secondary)" } : undefined}
          >
            <TrendingDown size={14} /> Below
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Target Price (USD)
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>$</span>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={targetPrice}
              onChange={(e) => {
                setTargetPrice(e.target.value);
                if (error) setError("");
              }}
              className="w-full pl-6 pr-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1"
              style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
            />
          </div>
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        {isValid && (
          <div className="text-xs px-2.5 py-2 rounded-lg" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
            Alert when <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{token.symbol}</span>{" "}
            {condition === "above" ? "rises above" : "drops below"}{" "}
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              ${parsed.toLocaleString()}
            </span>
          </div>
        )}

        <button
          type="submit"
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-white"
          style={{ backgroundColor: "#408A71" }}
        >
          Create alert
        </button>
      </form>
    </div>
  );
}
