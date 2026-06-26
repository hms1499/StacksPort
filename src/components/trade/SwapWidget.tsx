"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownUp,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";
import { openContractCall } from "@stacks/connect";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { formatAmount } from "@/lib/utils";
import {
  getValidDestinations,
  getRoute,
  getQuote,
  buildSwapParams,
  applySlippageFloor,
  amountForPercent,
  isQuoteStale,
  QUOTE_TTL_MS,
  isBelowMinSwap,
  minSwapHuman,
  sanitizeAmountInput,
  exceedsBalance,
  lacksStxForFee,
  resolveUnitUsd,
  formatUsd,
  quoteSecondsLeft,
  type SwapToken,
  type QuoteResult,
} from "@/lib/direct-swap";
import { useSwapPrices } from "@/hooks/useMarketData";
import SwapPairChart from "./SwapPairChart";
import { trackTx } from "@/lib/tx-tracker";
import { track } from "@/lib/telemetry";
import { SimpleTokenSelector } from "./swap/TokenSelector";
import { SwapSuccess } from "./swap/SwapSuccess";
import { QuoteDetails } from "./swap/QuoteDetails";
import {
  resolveInitialPair,
  fetchTokenBalance,
  fromTokens,
  STX_TOKEN,
  type Status,
} from "./swap/helpers";

export default function SwapWidget() {
  const searchParams = useSearchParams();
  const { stxAddress, isConnected, network } = useWalletStore();
  const t = useTranslations("trade.swap");
  const { addNotification } = useNotificationStore();
  const { data: swapPrices } = useSwapPrices();

  const initialPair = (() => {
    return resolveInitialPair(
      searchParams.get("from"),
      searchParams.get("to")
    );
  })();

  const [fromToken, setFromToken] = useState<SwapToken>(initialPair.from);
  const [toToken, setToToken] = useState<SwapToken | null>(initialPair.to);
  const [amountIn, setAmountIn] = useState(() => {
    const raw = searchParams.get("amount") ?? "";
    return raw ? sanitizeAmountInput(raw, initialPair.from.decimals) : "";
  });
  const [slippage, setSlippage] = useState(0.5);

  const [fromBalance, setFromBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [stxBalance, setStxBalance] = useState<number | null>(null);
  // Bumped after a successful swap to force a balance re-fetch.
  const [balanceNonce, setBalanceNonce] = useState(0);

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  // Ticks every second while a quote is live, to drive the refresh countdown.
  const [nowTick, setNowTick] = useState(() => Date.now());

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id: only the newest in-flight quote may write state, so a slow
  // earlier request can never clobber a fresher one (out-of-order resolve).
  const quoteReqId = useRef(0);

  // Valid destinations based on fromToken
  const toTokens = getValidDestinations(fromToken.id);

  // Fetch from-token balance when token or address changes
  useEffect(() => {
    if (!stxAddress) {
      setFromBalance(null);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    fetchTokenBalance(stxAddress, fromToken)
      .then((bal) => { if (!cancelled) setFromBalance(bal); })
      .catch(() => { if (!cancelled) setFromBalance(null); })
      .finally(() => { if (!cancelled) setBalanceLoading(false); });
    return () => { cancelled = true; };
  }, [fromToken, stxAddress, balanceNonce]);

  // STX balance for the fee-coverage warning. Only fetched for a non-STX
  // source (the warning never shows when source IS STX — lacksStxForFee
  // short-circuits). In the STX branch we mirror fromBalance just to keep the
  // value sane; it is intentionally NOT in the deps (fromBalance read there is
  // best-effort and irrelevant to the banner), which avoids a doubled STX
  // fetch every time the non-STX balance resolves.
  useEffect(() => {
    if (!stxAddress) {
      setStxBalance(null);
      return;
    }
    if (fromToken.id === "stx") {
      setStxBalance(fromBalance);
      return;
    }
    let cancelled = false;
    fetchTokenBalance(stxAddress, STX_TOKEN)
      .then((b) => { if (!cancelled) setStxBalance(b); })
      .catch(() => { if (!cancelled) setStxBalance(null); });
    return () => { cancelled = true; };
    // fromBalance intentionally omitted — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken.id, stxAddress, balanceNonce]);

  function setPercent(pct: number) {
    if (fromBalance === null || fromBalance <= 0) return;
    setAmountIn(
      amountForPercent(
        fromBalance,
        pct,
        fromToken.contract === null, // native STX
        fromToken.decimals
      )
    );
  }

  // Debounced quote fetch
  const fetchQuote = useCallback(
    async (from: SwapToken, to: SwapToken, amt: number) => {
      const reqId = ++quoteReqId.current;
      if (!from || !to || !amt || amt <= 0) {
        setQuote(null);
        setStatus("idle");
        return;
      }
      setStatus("quoting");
      try {
        const result = await getQuote(from.id, to.id, amt);
        if (reqId !== quoteReqId.current) return; // a newer request superseded us
        setQuote(result);
        setStatus("ready");
      } catch (e) {
        if (reqId !== quoteReqId.current) return;
        setQuote(null);
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : t("errQuote"));
      }
    },
    [t]
  );

  useEffect(() => {
    const amt = parseFloat(amountIn);
    if (!toToken || !amountIn || isNaN(amt)) {
      setQuote(null);
      setStatus("idle");
      return;
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => fetchQuote(fromToken, toToken, amt), 600);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [fromToken, toToken, amountIn, fetchQuote]);

  // Auto-refresh a ready quote just before it goes stale, so the user never
  // signs a price that has drifted past the slippage tolerance.
  useEffect(() => {
    if (status !== "ready" || !quote || !toToken) return;
    const amt = parseFloat(amountIn);
    if (isNaN(amt)) return;
    const delay = Math.max(QUOTE_TTL_MS - (Date.now() - quote.quotedAt), 0);
    const timer = setTimeout(() => fetchQuote(fromToken, toToken, amt), delay);
    return () => clearTimeout(timer);
  }, [status, quote, fromToken, toToken, amountIn, fetchQuote]);

  // 1s tick for the countdown — only while a quote is actually live.
  useEffect(() => {
    if (status !== "ready" || !quote) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status, quote]);

  const secondsLeft = quote ? quoteSecondsLeft(quote.quotedAt, nowTick) : 0;

  // Manual "refresh price now" — re-quotes immediately with the current amount.
  function refreshQuote() {
    if (!toToken) return;
    const amt = parseFloat(amountIn);
    if (isNaN(amt) || amt <= 0) return;
    fetchQuote(fromToken, toToken, amt);
  }

  // Swap from↔to — only if reverse route exists
  function flipTokens() {
    if (!toToken) return;
    const reverseRoute = getRoute(toToken.id, fromToken.id);
    if (!reverseRoute) return;
    const prevTo = toToken;
    setFromToken(prevTo);
    setToToken(fromToken);
    setAmountIn("");
    setQuote(null);
    setStatus("idle");
    setErrorMsg(null);
  }

  const canFlip = toToken ? !!getRoute(toToken.id, fromToken.id) : false;

  // Handle fromToken change
  function handleFromTokenChange(t: SwapToken) {
    setFromToken(t);
    // Reset toToken if it's no longer a valid destination
    const validDests = getValidDestinations(t.id);
    if (toToken && !validDests.find((d) => d.id === toToken.id)) {
      setToToken(null);
    }
    setAmountIn("");
    setQuote(null);
    setStatus("idle");
    setErrorMsg(null);
  }

  // Execute swap
  async function handleSwap() {
    if (!quote || !stxAddress || !toToken) return;

    if (isBelowMinSwap(fromToken.id, amountIn)) {
      setErrorMsg(
        `Minimum swap is ${minSwapHuman(fromToken.id)} ${fromToken.symbol}`
      );
      setStatus("error");
      return;
    }

    // Defensive: never sign a stale price. Re-quote instead of submitting.
    if (isQuoteStale(quote.quotedAt)) {
      const amt = parseFloat(amountIn);
      setErrorMsg(t("errExpired"));
      setStatus("error");
      if (!isNaN(amt)) fetchQuote(fromToken, toToken, amt);
      return;
    }

    setStatus("swapping");
    setErrorMsg(null);
    // Invalidate any in-flight quote refresh — once we commit to signing
    // with the on-screen quote, a later refresh resolving mid-sign must
    // not overwrite `quote` and silently change minAmountOut.
    quoteReqId.current++;

    try {
      const minAmountOutRaw = applySlippageFloor(
        BigInt(Math.floor(quote.amountOut)),
        slippage
      );
      const params = buildSwapParams(
        fromToken.id,
        toToken.id,
        amountIn,
        minAmountOutRaw,
        stxAddress
      );

      openContractCall({
        contractAddress: params.contractAddress,
        contractName: params.contractName,
        functionName: params.functionName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        functionArgs: params.functionArgs as any[],
        postConditions: params.postConditions,
        postConditionMode: params.postConditionMode,
        network,
        onFinish: ({ txId: id }) => {
          setTxId(id);
          setStatus("success");
          track("swap_executed"); // funnel: alternate activation path
          setBalanceNonce((n) => n + 1); // refetch balance post-swap
          addNotification(
            `Swap submitted: ${fromToken.symbol} → ${toToken.symbol}`,
            "info",
            "swap",
            5000,
            { txId: id, amount: amountIn, tokenSymbol: toToken.symbol }
          );
          // Poll cho đến khi tx confirm/fail trên chain
          trackTx({
            txId: id,
            label: t("swapPair", { from: fromToken.symbol, to: toToken.symbol }),
            category: "swap",
            context: { txId: id, amount: amountIn, tokenSymbol: toToken.symbol },
            addNotification,
            address: stxAddress,
          });
        },
        onCancel: () => setStatus("ready"),
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : t("errFailed");
      setErrorMsg(errorMessage);
      setStatus("error");
      addNotification(`Swap failed: ${errorMessage}`, "error", "swap", 5000);
    }
  }

  // Min received display
  const minReceived =
    quote && toToken
      ? (quote.amountOut * (1 - slippage / 100)) / Math.pow(10, toToken.decimals)
      : null;

  // Contract rejects sub-minimum swaps on-chain — block before signing.
  const belowMin = !!amountIn && isBelowMinSwap(fromToken.id, amountIn);

  // ≈ USD value of the input / output. null when the price is unknown or the
  // amount isn't a positive number, so the line is hidden rather than "$0.00".
  const amountInNum = parseFloat(amountIn);
  const fromUnitUsd = resolveUnitUsd(fromToken.id, swapPrices);
  const fromUsd =
    fromUnitUsd !== null && amountInNum > 0
      ? formatUsd(amountInNum * fromUnitUsd)
      : null;
  const toUnitUsd = toToken ? resolveUnitUsd(toToken.id, swapPrices) : null;
  const toUsd =
    quote && toUnitUsd !== null
      ? formatUsd(quote.amountOutHuman * toUnitUsd)
      : null;

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === "success" && txId) {
    return (
      <SwapSuccess
        fromSymbol={fromToken.symbol}
        toSymbol={toToken?.symbol}
        txId={txId}
        network={network}
        onNewSwap={() => {
          setStatus("idle");
          setTxId(null);
          setAmountIn("");
          setQuote(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* From token */}
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <SimpleTokenSelector
          tokens={fromTokens}
          selected={fromToken}
          onChange={handleFromTokenChange}
          label={t("from")}
        />

        {/* Balance + % shortcuts */}
        {isConnected && (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Balance:{" "}
              {balanceLoading ? (
                <span className="inline-block w-12 h-3 rounded animate-pulse align-middle" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              ) : fromBalance !== null ? (
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {formatAmount(fromBalance, fromToken.decimals)} {fromToken.symbol}
                </span>
              ) : (
                "—"
              )}
            </span>
            <div className="flex gap-1">
              {[0.25, 0.5, 1].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setPercent(pct)}
                  disabled={!fromBalance}
                  className="px-2 py-0.5 text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent-text)' }}
                >
                  {pct === 1 ? "MAX" : `${pct * 100}%`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
            Amount
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amountIn}
              onChange={(e) =>
                setAmountIn(
                  sanitizeAmountInput(e.target.value, fromToken.decimals)
                )
              }
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors"
              style={
                isConnected && fromBalance !== null && exceedsBalance(amountIn, fromBalance, fromToken.decimals)
                  ? { borderColor: 'rgb(252,165,165)', backgroundColor: 'var(--bg-card)', color: 'rgb(239,68,68)' }
                  : { borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }
              }
            />
          </div>
          {fromUsd && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              ≈ {fromUsd}
            </p>
          )}
          {isConnected &&
            fromBalance !== null &&
            amountIn &&
            exceedsBalance(amountIn, fromBalance, fromToken.decimals) && (
              <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1.5">
                <AlertCircle size={12} />
                Insufficient balance. Max:{" "}
                {formatAmount(fromBalance, fromToken.decimals)} {fromToken.symbol}
              </p>
            )}
          {belowMin && (
            <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1.5">
              <AlertCircle size={12} />
              Minimum swap is {minSwapHuman(fromToken.id)} {fromToken.symbol}
            </p>
          )}
        </div>
      </div>

      {/* Flip button */}
      <div className="flex justify-center">
        <button
          onClick={flipTokens}
          disabled={!canFlip}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
        >
          <ArrowDownUp size={15} />
        </button>
      </div>

      {/* To token */}
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <SimpleTokenSelector
          tokens={toTokens}
          selected={toToken}
          onChange={setToToken}
          label={t("to")}
        />
        {/* Quote output */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
            {t("youReceive")}
          </label>
          <div className="px-3.5 py-2.5 rounded-xl border min-h-[42px] flex items-center" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
            {status === "quoting" ? (
              <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={13} className="animate-spin" /> Fetching quote...
              </span>
            ) : quote && toToken ? (
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatAmount(quote.amountOutHuman, toToken.decimals)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{toToken.symbol}</span>
              </div>
            ) : (
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
            )}
          </div>
          {toUsd && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              ≈ {toUsd}
            </p>
          )}
        </div>
      </div>

      {/* Pair sparkline — only when a destination is selected */}
      {toToken && (
        <div className="rounded-xl px-4 py-2" style={{ backgroundColor: "var(--bg-elevated)" }}>
          <SwapPairChart fromToken={fromToken} toToken={toToken} />
        </div>
      )}

      {/* Route & details */}
      {quote && (
        <QuoteDetails
          quote={quote}
          fromSymbol={fromToken.symbol}
          toToken={toToken}
          amountIn={amountIn}
          slippage={slippage}
          setSlippage={setSlippage}
          status={status}
          secondsLeft={secondsLeft}
          minReceived={minReceived}
          onRefresh={refreshQuote}
        />
      )}

      {/* Error */}
      {status === "error" && errorMsg && (
        <div className="flex items-center gap-2 text-xs text-red-500 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'rgba(239,68,68,0.08)' }}>
          <AlertCircle size={13} />
          {errorMsg}
        </div>
      )}

      {/* High price-impact warning */}
      {quote && quote.priceImpact >= 0.05 && status === "ready" && (
        <div className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'rgb(239,68,68)' }}>
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>
            High price impact ({(quote.priceImpact * 100).toFixed(2)}%). You may
            lose value on this trade — consider a smaller amount.
          </span>
        </div>
      )}

      {/* Low STX for fee — non-STX source only; only after an amount is typed; warn, do not block */}
      {isConnected &&
        stxBalance !== null &&
        !!amountIn &&
        lacksStxForFee(fromToken.id, stxBalance) && (
          <div
            className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5"
            style={{ backgroundColor: "rgba(234,179,8,0.10)", color: "rgb(234,179,8)" }}
          >
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>
              Low STX balance — you may not have enough STX to cover the
              transaction fee.
            </span>
          </div>
        )}

      {/* Wallet not connected */}
      {!isConnected && (
        <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2.5" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
          <Info size={13} />
          {t("connectToSwap")}
        </div>
      )}

      {/* Swap button */}
      <button
        onClick={handleSwap}
        disabled={
          !isConnected ||
          status !== "ready" ||
          !quote ||
          !toToken ||
          belowMin ||
          (fromBalance !== null && exceedsBalance(amountIn, fromBalance, fromToken.decimals))
        }
        className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }}
      >
        {status === "swapping" ? (
          <>
            <Loader2 size={15} className="animate-spin" /> {t("waitingWallet")}
          </>
        ) : status === "quoting" ? (
          <>
            <Loader2 size={15} className="animate-spin" /> {t("gettingQuote")}
          </>
        ) : fromToken && toToken ? (
          t("swapPair", { from: fromToken.symbol, to: toToken.symbol })
        ) : (
          t("selectTokens")
        )}
      </button>

      {/* Powered by */}
      <p className="text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {t("poweredBy")}{" "}
        <a
          href="https://bitflow.finance"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent-text)' }}
        >
          Bitflow Pools
        </a>
      </p>
    </div>
  );
}
