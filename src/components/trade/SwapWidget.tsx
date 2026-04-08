"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ArrowDownUp,
  Loader2,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  ArrowRight,
} from "lucide-react";
import { openContractCall } from "@stacks/connect";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { formatAmount } from "@/lib/utils";
import {
  getSwappableFromTokens,
  getValidDestinations,
  getRoute,
  getQuote,
  buildSwapParams,
  type SwapToken,
  type QuoteResult,
} from "@/lib/direct-swap";

// ─── Simple Token Selector ────────────────────────────────────────────────────

function SimpleTokenSelector({
  tokens,
  selected,
  onChange,
  label,
}: {
  tokens: SwapToken[];
  selected: SwapToken | null;
  onChange: (t: SwapToken) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-medium text-gray-400 mb-1.5">{label}</p>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-[#B0E4CC] transition-colors bg-white dark:bg-gray-700"
      >
        {selected ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.icon}
              alt={selected.symbol}
              className="w-6 h-6 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {selected.symbol}
            </span>
            <span className="text-xs text-gray-400 truncate flex-1 text-left">
              {selected.name}
            </span>
          </>
        ) : (
          <span className="text-sm text-gray-400 flex-1 text-left">Select token</span>
        )}
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {tokens.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No tokens available</p>
            ) : (
              tokens.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-left ${
                    selected?.id === t.id
                      ? "bg-[#B0E4CC]/20 dark:bg-[#285A48]/30"
                      : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.icon}
                    alt={t.symbol}
                    className="w-6 h-6 rounded-full shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t.symbol}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{t.name}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Route Path ───────────────────────────────────────────────────────────────

function RoutePath({ hops }: { hops: string[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {hops.map((hop, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded-full">
            {hop}
          </span>
          {i < hops.length - 1 && <ArrowRight size={10} className="text-gray-400" />}
        </span>
      ))}
    </div>
  );
}

// ─── Balance helpers ───────────────────────────────────────────────────────────

const HIRO_API = "https://api.hiro.so";

async function fetchTokenBalance(address: string, token: SwapToken): Promise<number> {
  if (!token.contract) {
    // Native STX
    const res = await fetch(`${HIRO_API}/v2/accounts/${address}?proof=0`);
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.balance ?? 0) / Math.pow(10, token.decimals);
  }
  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
  if (!res.ok) return 0;
  const data = await res.json();
  const fts = (data.fungible_tokens ?? {}) as Record<string, { balance: string }>;
  const contractId = token.contract.toLowerCase();
  const match = Object.entries(fts).find(([key]) =>
    key.toLowerCase().startsWith(contractId)
  );
  if (!match) return 0;
  return Number(match[1].balance) / Math.pow(10, token.decimals);
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Status = "idle" | "quoting" | "ready" | "swapping" | "success" | "error";

const fromTokens = getSwappableFromTokens();

export default function SwapWidget() {
  const { stxAddress, isConnected, network } = useWalletStore();
  const { addNotification } = useNotificationStore();

  const [fromToken, setFromToken] = useState<SwapToken>(fromTokens[0]);
  const [toToken, setToToken] = useState<SwapToken | null>(null);
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState(0.5);

  const [fromBalance, setFromBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Valid destinations based on fromToken
  const toTokens = getValidDestinations(fromToken.id);

  // Fetch from-token balance when token or address changes
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [fromToken, stxAddress]);

  function setPercent(pct: number) {
    if (fromBalance === null || fromBalance <= 0) return;
    const val = fromBalance * pct;
    const decimals = Math.min(fromToken.decimals, 6);
    setAmountIn(parseFloat(val.toFixed(decimals)).toString());
  }

  // Debounced quote fetch
  const fetchQuote = useCallback(
    async (from: SwapToken, to: SwapToken, amt: number) => {
      if (!from || !to || !amt || amt <= 0) {
        setQuote(null);
        setStatus("idle");
        return;
      }
      setStatus("quoting");
      try {
        const result = await getQuote(from.id, to.id, amt);
        setQuote(result);
        setStatus("ready");
      } catch (e) {
        setQuote(null);
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "Failed to get quote");
      }
    },
    []
  );

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }

  // Execute swap
  async function handleSwap() {
    if (!quote || !stxAddress || !toToken) return;
    setStatus("swapping");
    setErrorMsg(null);

    try {
      const minAmountOutRaw = Math.floor(
        quote.amountOut * (1 - slippage / 100)
      );
      const params = buildSwapParams(
        fromToken.id,
        toToken.id,
        parseFloat(amountIn),
        minAmountOutRaw,
        stxAddress
      );

      openContractCall({
        contractAddress: params.contractAddress,
        contractName: params.contractName,
        functionName: params.functionName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        functionArgs: params.functionArgs as any[],
        postConditions: [],
        postConditionMode: params.postConditionMode,
        network,
        onFinish: ({ txId: id }) => {
          setTxId(id);
          setStatus("success");
          addNotification(
            `Swap executed: ${fromToken.symbol} → ${toToken.symbol}`,
            "success",
            "swap",
            5000,
            { txId: id, amount: amountIn, tokenSymbol: toToken.symbol }
          );
        },
        onCancel: () => setStatus("ready"),
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Swap failed";
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

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === "success" && txId) {
    return (
      <div className="flex flex-col items-center py-10 gap-4 text-center">
        <CheckCircle2 size={52} className="text-green-500" />
        <div>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Swap Submitted!
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {fromToken.symbol} → {toToken?.symbol}
          </p>
        </div>
        <a
          href={`https://explorer.hiro.so/txid/${txId}?chain=${network}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-[#408A71] hover:text-[#285A48] underline"
        >
          View on Explorer <ExternalLink size={13} />
        </a>
        <button
          onClick={() => {
            setStatus("idle");
            setTxId(null);
            setAmountIn("");
            setQuote(null);
          }}
          className="mt-2 px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-600 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-500 transition-colors"
        >
          New Swap
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* From token */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
        <SimpleTokenSelector
          tokens={fromTokens}
          selected={fromToken}
          onChange={handleFromTokenChange}
          label="From"
        />

        {/* Balance + % shortcuts */}
        {isConnected && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Balance:{" "}
              {balanceLoading ? (
                <span className="inline-block w-12 h-3 bg-gray-200 dark:bg-gray-600 rounded animate-pulse align-middle" />
              ) : fromBalance !== null ? (
                <span className="font-medium text-gray-600 dark:text-gray-300">
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
                  className="px-2 py-0.5 text-[11px] font-semibold rounded-lg bg-[#B0E4CC]/20 dark:bg-[#285A48]/30 text-[#285A48] dark:text-[#B0E4CC] hover:bg-[#B0E4CC]/30 dark:hover:bg-[#285A48]/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {pct === 1 ? "MAX" : `${pct * 100}%`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-400 mb-1.5 block">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              min="0"
              step="any"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 placeholder:text-gray-300 dark:placeholder:text-gray-500 transition-colors ${
                isConnected &&
                fromBalance !== null &&
                parseFloat(amountIn) > fromBalance
                  ? "border-red-300 focus:ring-red-300 text-red-600"
                  : "border-gray-200 dark:border-gray-600 focus:ring-[#B0E4CC] text-gray-900 dark:text-gray-100"
              }`}
            />
          </div>
          {isConnected &&
            fromBalance !== null &&
            amountIn &&
            parseFloat(amountIn) > fromBalance && (
              <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1.5">
                <AlertCircle size={12} />
                Insufficient balance. Max:{" "}
                {formatAmount(fromBalance, fromToken.decimals)} {fromToken.symbol}
              </p>
            )}
        </div>
      </div>

      {/* Flip button */}
      <div className="flex justify-center">
        <button
          onClick={flipTokens}
          disabled={!canFlip}
          className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-[#B0E4CC] transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowDownUp size={15} className="text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* To token */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
        <SimpleTokenSelector
          tokens={toTokens}
          selected={toToken}
          onChange={setToToken}
          label="To"
        />
        {/* Quote output */}
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1.5 block">
            You receive (estimated)
          </label>
          <div className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 min-h-[42px] flex items-center">
            {status === "quoting" ? (
              <span className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={13} className="animate-spin" /> Fetching quote...
              </span>
            ) : quote && toToken ? (
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatAmount(quote.amountOutHuman, toToken.decimals)}
                </span>
                <span className="text-xs text-gray-400">{toToken.symbol}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-300 dark:text-gray-500">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Route & details */}
      {quote && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 space-y-2.5">
          {quote.route.hops.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-400 mt-0.5 shrink-0">Route</span>
              <RoutePath hops={quote.route.hops} />
            </div>
          )}
          {minReceived !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Min received</span>
              <span className="text-gray-600 dark:text-gray-300">
                {formatAmount(minReceived, toToken?.decimals ?? 6)} {toToken?.symbol}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Slippage</span>
            <div className="flex gap-1">
              {[0.1, 0.5, 1].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={`px-2 py-0.5 rounded-lg font-medium transition-colors ${
                    slippage === s
                      ? "bg-gray-900 dark:bg-gray-500 text-white"
                      : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && errorMsg && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5">
          <AlertCircle size={13} />
          {errorMsg}
        </div>
      )}

      {/* Wallet not connected */}
      {!isConnected && (
        <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-3 py-2.5">
          <Info size={13} />
          Connect your wallet to swap
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
          (fromBalance !== null && parseFloat(amountIn) > fromBalance)
        }
        className="w-full py-3.5 rounded-xl bg-[#408A71] text-white text-sm font-semibold hover:bg-[#285A48] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {status === "swapping" ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Waiting for wallet...
          </>
        ) : status === "quoting" ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Getting quote...
          </>
        ) : fromToken && toToken ? (
          `Swap ${fromToken.symbol} → ${toToken.symbol}`
        ) : (
          "Select tokens"
        )}
      </button>

      {/* Powered by */}
      <p className="text-center text-[11px] text-gray-300 dark:text-gray-500">
        Powered by{" "}
        <a
          href="https://bitflow.finance"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#B0E4CC] hover:text-[#408A71]"
        >
          Bitflow Pools
        </a>
      </p>
    </div>
  );
}
