"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  SWAP_TOKENS,
  getValidDestinations,
  getQuote,
  sanitizeAmountInput,
  type SwapToken,
} from "@/lib/direct-swap";
import { type TokenWithValue } from "@/lib/stacks";

function formatBalance(n: number): string {
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n >= 1) return n.toFixed(6);
  return n.toFixed(8);
}

function resolveSwapFrom(
  token: TokenWithValue,
  isSTX: boolean
): SwapToken | null {
  if (isSTX) return SWAP_TOKENS.find((t) => t.id === "stx") ?? null;
  if (!token.contractId) return null;
  return SWAP_TOKENS.find((t) => t.contract === token.contractId) ?? null;
}

function formatOut(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n >= 1) return n.toFixed(6);
  if (n >= 0.0001) return n.toFixed(8);
  return n.toExponential(3);
}

export default function QuickSwap({
  token,
  isSTX,
  onClose,
}: {
  token: TokenWithValue;
  isSTX: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("assets.drawer.qswap");
  const router = useRouter();
  const fromToken = resolveSwapFrom(token, isSTX);
  const dests = useMemo(
    () => (fromToken ? getValidDestinations(fromToken.id) : []),
    [fromToken]
  );
  const [toId, setToId] = useState<string>(dests[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [quoteOut, setQuoteOut] = useState<number | null>(null);
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep toId in sync if the swap pair changes (e.g. user opens a different token)
  useEffect(() => {
    if (dests.length === 0) {
      setToId("");
    } else if (!dests.some((d) => d.id === toId)) {
      setToId(dests[0].id);
    }
  }, [dests, toId]);

  // Debounced quote fetch
  useEffect(() => {
    setError(null);
    const n = Number(amount);
    if (!fromToken || !toId || !Number.isFinite(n) || n <= 0) {
      setQuoteOut(null);
      setPriceImpact(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const id = setTimeout(async () => {
      try {
        const q = await getQuote(fromToken.id, toId, n);
        if (cancelled) return;
        setQuoteOut(q.amountOutHuman);
        setPriceImpact(q.priceImpact);
      } catch (e) {
        if (cancelled) return;
        setQuoteOut(null);
        setPriceImpact(null);
        setError(e instanceof Error ? e.message : t("quoteUnavailable"));
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [amount, fromToken, toId, t]);

  if (!fromToken || dests.length === 0) return null;

  const toToken = dests.find((d) => d.id === toId) ?? dests[0];
  const balance = token.balance;
  const overBalance = Number(amount) > balance;

  const onMax = () => {
    setAmount(sanitizeAmountInput(String(balance), fromToken.decimals));
  };

  const onContinue = () => {
    const q = new URLSearchParams({ from: fromToken.id, to: toId });
    if (amount) q.set("amount", amount);
    router.push(`/trade?${q.toString()}`);
    onClose();
  };

  const canContinue =
    !!amount && Number(amount) > 0 && !overBalance && quoteOut != null;

  return (
    <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-xs uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {t("title")}
        </p>
        <div className="flex gap-1">
          {dests.map((d) => {
            const active = d.id === toId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setToId(d.id)}
                className="text-[11px] font-semibold px-2 py-1 rounded-md transition-colors"
                style={{
                  backgroundColor: active ? "var(--accent)" : "var(--bg-elevated)",
                  color: active ? "#0A1628" : "var(--text-muted)",
                }}
                aria-pressed={active}
              >
                {d.symbol}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-xl p-3 flex items-center gap-2"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) =>
            setAmount(sanitizeAmountInput(e.target.value, fromToken.decimals))
          }
          placeholder="0.0"
          className="flex-1 bg-transparent outline-none text-base font-mono"
          style={{ color: "var(--text-primary)" }}
          aria-label={`Amount in ${fromToken.symbol}`}
        />
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {fromToken.symbol}
        </span>
        <button
          type="button"
          onClick={onMax}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors"
          style={{
            backgroundColor: "var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          {t("max")}
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 min-h-[18px] text-xs">
        <span style={{ color: "var(--text-muted)" }}>
          {t("balance", { bal: formatBalance(balance), symbol: fromToken.symbol })}
        </span>
        {overBalance ? (
          <span className="text-red-500 font-medium">{t("exceeds")}</span>
        ) : quoting ? (
          <span style={{ color: "var(--text-muted)" }}>{t("quoting")}</span>
        ) : quoteOut != null && toToken ? (
          <span style={{ color: "var(--text-secondary)" }}>
            {t("approx", { out: formatOut(quoteOut), symbol: toToken.symbol })}
            {priceImpact != null && Math.abs(priceImpact) >= 0.5 && (
              <span
                className={priceImpact >= 5 ? "text-red-500 ml-1" : "ml-1"}
                style={priceImpact >= 5 ? undefined : { color: "var(--text-muted)" }}
              >
                ({priceImpact.toFixed(2)}%)
              </span>
            )}
          </span>
        ) : error ? (
          <span style={{ color: "var(--text-muted)" }}>{error}</span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--accent)",
          color: "#0A1628",
        }}
      >
        {amount && !overBalance ? t("continue") : t("enterAmount")}
      </button>
    </div>
  );
}
