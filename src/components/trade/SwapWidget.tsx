"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
import { PostConditionMode } from "@stacks/transactions";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { formatAmount, formatUSD } from "@/lib/utils";
import type { Token, QuoteResult } from "@bitflowlabs/core-sdk";

// Deserialize bigint placeholders from API response
function deserialize(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj), (_, v) =>
    v && typeof v === "object" && "__bigint" in v ? BigInt(v.__bigint) : v
  );
}

// ─── Token Selector ───────────────────────────────────────────────────────────

function TokenSelector({
  tokens,
  selected,
  onChange,
  label,
}: {
  tokens: Token[];
  selected: Token | null;
  onChange: (t: Token) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(
    () =>
      tokens.filter(
        (t) =>
          t.symbol.toLowerCase().includes(search.toLowerCase()) ||
          t.name.toLowerCase().includes(search.toLowerCase())
      ),
    [tokens, search]
  );

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-medium text-gray-400 mb-1.5">{label}</p>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-teal-400 transition-colors bg-white dark:bg-gray-700"
      >
        {selected ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.icon} alt={selected.symbol} className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{selected.symbol}</span>
            <span className="text-xs text-gray-400 truncate flex-1 text-left">{selected.name}</span>
          </>
        ) : (
          <span className="text-sm text-gray-400 flex-1 text-left">Select token</span>
        )}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-50 dark:border-gray-600">
            <input
              autoFocus
              type="text"
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-600 dark:text-gray-100 dark:placeholder:text-gray-400 border-0 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No tokens found</p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.tokenId}
                  onClick={() => { onChange(t); setOpen(false); setSearch(""); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-left ${selected?.tokenId === t.tokenId ? "bg-teal-50 dark:bg-teal-900/30" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.icon} alt={t.symbol} className="w-6 h-6 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.symbol}</p>
                    <p className="text-xs text-gray-400 truncate">{t.name}</p>
                  </div>
                  {t.priceData.last_price && (
                    <span className="ml-auto text-xs text-gray-400 shrink-0">{formatUSD(t.priceData.last_price)}</span>
                  )}
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

function RoutePath({ path }: { path: string[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {path.map((token, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded-full">
            {token.replace("token-", "").toUpperCase()}
          </span>
          {i < path.length - 1 && <ArrowRight size={10} className="text-gray-400" />}
        </span>
      ))}
    </div>
  );
}

// ─── Balance helpers ───────────────────────────────────────────────────────────

const HIRO_API = "https://api.hiro.so";

async function fetchFromBalance(address: string, token: Token): Promise<number> {
  const isSTX = !token.tokenContract || token.tokenId === "token-stx";

  if (isSTX) {
    const res = await fetch(`${HIRO_API}/v2/accounts/${address}?proof=0`);
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.balance ?? 0) / 1e6;
  }

  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
  if (!res.ok) return 0;
  const data = await res.json();
  const fts = (data.fungible_tokens ?? {}) as Record<string, { balance: string }>;

  // Match by tokenContract prefix (key format: "contract::token-name")
  const contractId = token.tokenContract!.toLowerCase();
  const match = Object.entries(fts).find(([key]) => key.toLowerCase().startsWith(contractId));
  if (!match) return 0;
  return Number(match[1].balance) / Math.pow(10, token.tokenDecimals);
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Status = "idle" | "quoting" | "ready" | "swapping" | "success" | "error";

export default function SwapWidget() {
  const { stxAddress, isConnected, network } = useWalletStore();
  const { addNotification } = useNotificationStore();

  const [tokens, setTokens] = useState<Token[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState(0.5);

  const [fromBalance, setFromBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch available tokens on mount
  useEffect(() => {
    fetch("/api/bitflow/tokens")
      .then((r) => r.json())
      .then((data: Token[] | { error: string }) => {
        if ("error" in data) throw new Error(data.error);
        setTokens(data);
        // Default: STX → first available token
        const stx = data.find((t) => t.tokenId === "token-stx" || t.symbol === "STX");
        if (stx) setFromToken(stx);
      })
      .catch((e) => setTokenError(e.message))
      .finally(() => setTokensLoading(false));
  }, []);

  // Fetch from-token balance when token or address changes
  useEffect(() => {
    if (!fromToken || !stxAddress) { setFromBalance(null); return; }
    setBalanceLoading(true);
    fetchFromBalance(stxAddress, fromToken)
      .then(setFromBalance)
      .catch(() => setFromBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [fromToken, stxAddress]);

  function setPercent(pct: number) {
    if (fromBalance === null || fromBalance <= 0) return;
    const val = fromBalance * pct;
    const decimals = Math.min(fromToken?.tokenDecimals ?? 6, 6);
    setAmountIn(parseFloat(val.toFixed(decimals)).toString());
  }

  // Debounced quote fetch
  const fetchQuote = useCallback(async (from: Token, to: Token, amt: number) => {
    if (!from || !to || !amt || amt <= 0) { setQuote(null); setStatus("idle"); return; }
    setStatus("quoting");
    try {
      const res = await fetch(`/api/bitflow/quote?from=${from.tokenId}&to=${to.tokenId}&amount=${amt}`);
      const data: QuoteResult | { error: string } = await res.json();
      if ("error" in data) throw new Error(data.error);
      setQuote(data);
      setStatus(data.bestRoute ? "ready" : "idle");
    } catch (e) {
      setQuote(null);
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to get quote");
    }
  }, []);

  useEffect(() => {
    const amt = parseFloat(amountIn);
    if (!fromToken || !toToken || !amountIn) { setQuote(null); setStatus("idle"); return; }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => fetchQuote(fromToken, toToken, amt), 600);
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current); };
  }, [fromToken, toToken, amountIn, fetchQuote]);

  // Swap from↔to
  function flipTokens() {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmountIn("");
    setQuote(null);
    setStatus("idle");
  }

  // Execute swap
  async function handleSwap() {
    if (!quote?.bestRoute || !stxAddress || !fromToken || !toToken) return;
    setStatus("swapping");
    setErrorMsg(null);

    try {
      const swapExecutionData = {
        route: quote.bestRoute.route,
        amount: parseFloat(amountIn),
        tokenXDecimals: fromToken.tokenDecimals,
        tokenYDecimals: toToken.tokenDecimals,
      };

      const res = await fetch("/api/bitflow/swap-params", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swapExecutionData, senderAddress: stxAddress, slippage }),
      });

      const raw = await res.json();
      if ("error" in raw) throw new Error(raw.error);

      const params = deserialize(raw) as {
        contractAddress: string;
        contractName: string;
        functionName: string;
        functionArgs: unknown[];
        postConditions: unknown[];
      };

      openContractCall({
        contractAddress: params.contractAddress,
        contractName: params.contractName,
        functionName: params.functionName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        functionArgs: params.functionArgs as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        postConditions: params.postConditions as any[],
        postConditionMode: PostConditionMode.Deny,
        network,
        onFinish: ({ txId: id }) => {
          setTxId(id);
          setStatus("success");
          addNotification(
            `Swap executed: ${fromToken?.symbol} → ${toToken?.symbol}`,
            'success',
            'swap',
            5000,
            { txId: id, amount: amountIn, tokenSymbol: toToken?.symbol }
          );
        },
        onCancel: () => setStatus("ready"),
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Swap failed";
      setErrorMsg(errorMessage);
      setStatus("error");
      addNotification(`Swap failed: ${errorMessage}`, 'error', 'swap', 5000);
    }
  }

  const amountOut = quote?.bestRoute?.quote ?? null;
  const priceImpact = 0; // SDK doesn't expose this directly
  const routePath = quote?.bestRoute?.tokenPath ?? [];
  const dexPath = quote?.bestRoute?.dexPath ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === "success" && txId) {
    return (
      <div className="flex flex-col items-center py-10 gap-4 text-center">
        <CheckCircle2 size={52} className="text-green-500" />
        <div>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Swap Submitted!</p>
          <p className="text-sm text-gray-400 mt-1">
            {fromToken?.symbol} → {toToken?.symbol}
          </p>
        </div>
        <a
          href={`https://explorer.hiro.so/txid/${txId}?chain=${network}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-teal-500 hover:text-teal-600 underline"
        >
          View on Explorer <ExternalLink size={13} />
        </a>
        <button
          onClick={() => { setStatus("idle"); setTxId(null); setAmountIn(""); setQuote(null); }}
          className="mt-2 px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-600 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-500 transition-colors"
        >
          New Swap
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Token loading error */}
      {tokenError && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5">
          <AlertCircle size={13} />
          {tokenError}
        </div>
      )}

      {tokensLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-xl" />
          <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-xl" />
          <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-xl" />
        </div>
      ) : (
        <>
          {/* From token */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
            <TokenSelector
              tokens={tokens}
              selected={fromToken}
              onChange={(t) => { setFromToken(t); if (t.tokenId === toToken?.tokenId) setToToken(null); }}
              label="From"
            />

            {/* Balance + % shortcuts */}
            {isConnected && fromToken && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Balance:{" "}
                  {balanceLoading ? (
                    <span className="inline-block w-12 h-3 bg-gray-200 dark:bg-gray-600 rounded animate-pulse align-middle" />
                  ) : fromBalance !== null ? (
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      {formatAmount(fromBalance, fromToken.tokenDecimals)} {fromToken.symbol}
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
                      className="px-2 py-0.5 text-[11px] font-semibold rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {pct === 1 ? "MAX" : `${pct * 100}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="any"
                  value={amountIn}
                  onChange={(e) => setAmountIn(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 placeholder:text-gray-300 dark:placeholder:text-gray-500 transition-colors ${
                    isConnected && fromBalance !== null && parseFloat(amountIn) > fromBalance
                      ? "border-red-300 focus:ring-red-300 text-red-600"
                      : "border-gray-200 dark:border-gray-600 focus:ring-teal-400 text-gray-900 dark:text-gray-100"
                  }`}
                />
                {fromToken?.priceData.last_price && amountIn && !(isConnected && fromBalance !== null && parseFloat(amountIn) > fromBalance) && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    ≈ {formatUSD(parseFloat(amountIn) * fromToken.priceData.last_price)}
                  </span>
                )}
              </div>
              {isConnected && fromBalance !== null && amountIn && parseFloat(amountIn) > fromBalance && (
                <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1.5">
                  <AlertCircle size={12} />
                  Insufficient balance. Max: {formatAmount(fromBalance, fromToken?.tokenDecimals)} {fromToken?.symbol}
                </p>
              )}
            </div>
          </div>

          {/* Flip button */}
          <div className="flex justify-center">
            <button
              onClick={flipTokens}
              className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-teal-400 transition-colors shadow-sm"
            >
              <ArrowDownUp size={15} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* To token */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
            <TokenSelector
              tokens={tokens.filter((t) => t.tokenId !== fromToken?.tokenId)}
              selected={toToken}
              onChange={setToToken}
              label="To"
            />
            {/* Quote output */}
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">You receive (estimated)</label>
              <div className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 min-h-[42px] flex items-center">
                {status === "quoting" ? (
                  <span className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 size={13} className="animate-spin" /> Fetching quote...
                  </span>
                ) : amountOut !== null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatAmount(amountOut, toToken?.tokenDecimals)}
                    </span>
                    <span className="text-xs text-gray-400">{toToken?.symbol}</span>
                    {toToken?.priceData.last_price && (
                      <span className="text-xs text-gray-400 ml-auto">
                        ≈ {formatUSD(amountOut * toToken.priceData.last_price)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-300 dark:text-gray-500">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Route & details */}
          {quote?.bestRoute && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 space-y-2.5">
              {routePath.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 mt-0.5 shrink-0">Route</span>
                  <RoutePath path={routePath} />
                </div>
              )}
              {dexPath.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Via</span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {dexPath.map((d) => d.replace(/-/g, " ")).join(" → ")}
                  </span>
                </div>
              )}
              {priceImpact > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Price Impact</span>
                  <span className={priceImpact > 2 ? "text-red-500 font-medium" : "text-gray-600 dark:text-gray-300"}>
                    {priceImpact.toFixed(2)}%
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
            disabled={!isConnected || status !== "ready" || !quote?.bestRoute || (fromBalance !== null && parseFloat(amountIn) > fromBalance)}
            className="w-full py-3.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {status === "swapping" ? (
              <><Loader2 size={15} className="animate-spin" /> Waiting for wallet...</>
            ) : status === "quoting" ? (
              <><Loader2 size={15} className="animate-spin" /> Getting quote...</>
            ) : fromToken && toToken ? (
              `Swap ${fromToken.symbol} → ${toToken.symbol}`
            ) : (
              "Select tokens"
            )}
          </button>

          {/* Powered by */}
          <p className="text-center text-[11px] text-gray-300 dark:text-gray-500">
            Powered by{" "}
            <a href="https://bitflow.finance" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-500">
              Bitflow
            </a>
          </p>
        </>
      )}
    </div>
  );
}
