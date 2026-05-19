"use client";

import { useEffect, useState, useCallback, useRef, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
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
import { getSTXBalance, getFungibleTokens } from "@/lib/stacks";
import {
  getSwappableFromTokens,
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
  slippageWarning,
  quoteRate,
  exceedsBalance,
  lacksStxForFee,
  resolveUnitUsd,
  formatUsd,
  type SwapToken,
  type QuoteResult,
} from "@/lib/direct-swap";
import { useSwapPrices } from "@/hooks/useMarketData";

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
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = `tokensel-${label.toLowerCase()}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openMenu() {
    const sel = tokens.findIndex((t) => t.id === selected?.id);
    setActiveIndex(sel >= 0 ? sel : 0);
    setOpen(true);
  }

  function closeMenu(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function commit(t: SwapToken) {
    onChange(t);
    closeMenu();
  }

  function onListKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, tokens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(tokens.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const t = tokens[activeIndex];
      if (t) commit(t);
    }
  }

  return (
    <div ref={ref} className="relative">
      <p id={`${listboxId}-label`} className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listboxId}-label`}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openMenu();
          }
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-colors"
        style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}
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
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {selected.symbol}
            </span>
            <span className="text-xs truncate flex-1 text-left" style={{ color: 'var(--text-muted)' }}>
              {selected.name}
            </span>
          </>
        ) : (
          <span className="text-sm flex-1 text-left" style={{ color: 'var(--text-muted)' }}>Select token</span>
        )}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-xl shadow-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div
            role="listbox"
            aria-labelledby={`${listboxId}-label`}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            className="max-h-52 overflow-y-auto outline-none"
          >
            {tokens.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No tokens available</p>
            ) : (
              tokens.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={selected?.id === t.id}
                  ref={(el) => {
                    if (i === activeIndex && open) el?.focus();
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => commit(t)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors text-left outline-none"
                  style={{
                    backgroundColor:
                      i === activeIndex
                        ? 'var(--bg-elevated)'
                        : selected?.id === t.id
                        ? 'var(--accent-dim)'
                        : 'transparent',
                  }}
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
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {t.symbol}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t.name}</p>
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
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}>
            {hop}
          </span>
          {i < hops.length - 1 && <ArrowRight size={10} style={{ color: 'var(--text-muted)' }} />}
        </span>
      ))}
    </div>
  );
}

// ─── Balance helpers ───────────────────────────────────────────────────────────

// Reuses the shared Hiro helpers (timeout + 30s revalidate) instead of a
// second, less robust fetch path. Errors fall back to 0 (handled by caller).
async function fetchTokenBalance(address: string, token: SwapToken): Promise<number> {
  try {
    if (!token.contract) {
      const data = await getSTXBalance(address);
      return Number(data.balance ?? 0) / Math.pow(10, token.decimals);
    }
    const data = await getFungibleTokens(address);
    const fts = (data.fungible_tokens ?? {}) as Record<string, { balance: string }>;
    const contractId = token.contract.toLowerCase();
    const match = Object.entries(fts).find(([key]) =>
      key.toLowerCase().startsWith(contractId)
    );
    if (!match) return 0;
    return Number(match[1].balance) / Math.pow(10, token.decimals);
  } catch {
    return 0;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Status = "idle" | "quoting" | "ready" | "swapping" | "success" | "error";

const fromTokens = getSwappableFromTokens();
const STX_TOKEN = fromTokens.find((t) => t.id === "stx")!;

function resolveInitialPair(
  fromParam: string | null,
  toParam: string | null
): { from: SwapToken; to: SwapToken | null } {
  const fromMatch = fromParam
    ? fromTokens.find((t) => t.id === fromParam.toLowerCase())
    : undefined;

  // If only `to` provided, pick a sensible source: STX for sBTC, sBTC otherwise.
  if (!fromMatch && toParam) {
    const toId = toParam.toLowerCase();
    const sourcesForTo = fromTokens.filter((t) =>
      getValidDestinations(t.id).some((d) => d.id === toId)
    );
    const preferred =
      sourcesForTo.find((t) => t.id === "stx") ?? sourcesForTo[0];
    if (preferred) {
      const dest = getValidDestinations(preferred.id).find((d) => d.id === toId);
      if (dest) return { from: preferred, to: dest };
    }
  }

  const from = fromMatch ?? fromTokens[0];
  const dests = getValidDestinations(from.id);
  const toMatch = toParam
    ? dests.find((d) => d.id === toParam.toLowerCase())
    : null;
  return { from, to: toMatch ?? null };
}

export default function SwapWidget() {
  const searchParams = useSearchParams();
  const { stxAddress, isConnected, network } = useWalletStore();
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
  const [amountIn, setAmountIn] = useState("");
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

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id: only the newest in-flight quote may write state, so a slow
  // earlier request can never clobber a fresher one (out-of-order resolve).
  const quoteReqId = useRef(0);

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
  }, [fromToken, stxAddress, balanceNonce]);

  // STX balance for the fee-coverage warning. Only fetched for a non-STX
  // source (the warning never shows when source IS STX — lacksStxForFee
  // short-circuits). In the STX branch we mirror fromBalance just to keep the
  // value sane; it is intentionally NOT in the deps (fromBalance read there is
  // best-effort and irrelevant to the banner), which avoids a doubled STX
  // fetch every time the non-STX balance resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
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

  // Auto-refresh a ready quote just before it goes stale, so the user never
  // signs a price that has drifted past the slippage tolerance.
  useEffect(() => {
    if (status !== "ready" || !quote || !toToken) return;
    const amt = parseFloat(amountIn);
    if (isNaN(amt)) return;
    const delay = Math.max(QUOTE_TTL_MS - (Date.now() - quote.quotedAt), 0);
    const t = setTimeout(() => fetchQuote(fromToken, toToken, amt), delay);
    return () => clearTimeout(t);
  }, [status, quote, fromToken, toToken, amountIn, fetchQuote]);

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
      setErrorMsg("Quote expired — refreshing price, please try again.");
      setStatus("error");
      if (!isNaN(amt)) fetchQuote(fromToken, toToken, amt);
      return;
    }

    setStatus("swapping");
    setErrorMsg(null);

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
          setBalanceNonce((n) => n + 1); // refetch balance post-swap
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
      <div className="flex flex-col items-center py-10 gap-4 text-center">
        <CheckCircle2 size={52} className="text-green-500" />
        <div>
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Swap Submitted!
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {fromToken.symbol} → {toToken?.symbol}
          </p>
        </div>
        <a
          href={`https://explorer.hiro.so/txid/${txId}?chain=${network}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm underline"
          style={{ color: 'var(--accent)' }}
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
          className="mt-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          New Swap
        </button>
      </div>
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
          label="From"
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
                  style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
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
          label="To"
        />
        {/* Quote output */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
            You receive (estimated)
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

      {/* Route & details */}
      {quote && (
        <div className="rounded-xl px-4 py-3 space-y-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          {quote.route.hops.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}>Route</span>
              <RoutePath hops={quote.route.hops} />
            </div>
          )}
          {toToken && (() => {
            const rate = quoteRate(parseFloat(amountIn), quote.amountOutHuman);
            return rate > 0 ? (
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Rate</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  1 {fromToken.symbol} ≈ {formatAmount(rate, toToken.decimals)}{" "}
                  {toToken.symbol}
                </span>
              </div>
            ) : null;
          })()}
          {minReceived !== null && (
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Min received</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {formatAmount(minReceived, toToken?.decimals ?? 6)} {toToken?.symbol}
              </span>
            </div>
          )}
          {quote.priceImpact > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Price impact</span>
              <span
                style={{
                  color:
                    quote.priceImpact >= 0.05
                      ? 'rgb(239,68,68)'
                      : quote.priceImpact >= 0.03
                      ? 'rgb(234,179,8)'
                      : 'var(--text-secondary)',
                }}
              >
                {(quote.priceImpact * 100).toFixed(2)}%
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Slippage</span>
            <div className="flex gap-1 items-center">
              {[0.1, 0.5, 1].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className="px-2 py-0.5 rounded-lg font-medium transition-colors"
                  style={
                    slippage === s
                      ? { backgroundColor: 'var(--text-primary)', color: 'var(--bg-surface)' }
                      : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }
                  }
                >
                  {s}%
                </button>
              ))}
              <span
                className="flex items-center rounded-lg overflow-hidden"
                style={{
                  border: `1px solid ${
                    ![0.1, 0.5, 1].includes(slippage)
                      ? 'var(--text-primary)'
                      : 'var(--border-default)'
                  }`,
                }}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Custom slippage percent"
                  value={slippage}
                  onChange={(e) => {
                    const v = parseFloat(
                      sanitizeAmountInput(e.target.value, 2)
                    );
                    setSlippage(isNaN(v) ? 0 : Math.min(v, 50));
                  }}
                  className="w-10 px-1.5 py-0.5 text-right bg-transparent focus:outline-none"
                  style={{ color: 'var(--text-secondary)' }}
                />
                <span className="pr-1.5" style={{ color: 'var(--text-muted)' }}>%</span>
              </span>
            </div>
          </div>
          {slippageWarning(slippage) && (
            <p
              className="text-xs"
              style={{
                color:
                  slippageWarning(slippage) === 'high'
                    ? 'rgb(239,68,68)'
                    : 'rgb(234,179,8)',
              }}
            >
              {slippageWarning(slippage) === 'high'
                ? 'High slippage — you may get a poor price or be front-run.'
                : 'Very low slippage — the swap will likely fail on any price move.'}
            </p>
          )}
        </div>
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
          belowMin ||
          (fromBalance !== null && exceedsBalance(amountIn, fromBalance, fromToken.decimals))
        }
        className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }}
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
      <p className="text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Powered by{" "}
        <a
          href="https://bitflow.finance"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent)' }}
        >
          Bitflow Pools
        </a>
      </p>
    </div>
  );
}
