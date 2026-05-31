import { RefreshCw } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import {
  quoteRate,
  slippageWarning,
  sanitizeAmountInput,
  type SwapToken,
  type QuoteResult,
} from "@/lib/direct-swap";
import { RoutePath } from "./RoutePath";
import type { Status } from "./helpers";

export function QuoteDetails({
  quote,
  fromSymbol,
  toToken,
  amountIn,
  slippage,
  setSlippage,
  status,
  secondsLeft,
  minReceived,
  onRefresh,
}: {
  quote: QuoteResult;
  fromSymbol: string;
  toToken: SwapToken | null;
  amountIn: string;
  slippage: number;
  setSlippage: (s: number) => void;
  status: Status;
  secondsLeft: number;
  minReceived: number | null;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-xl px-4 py-3 space-y-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: 'var(--text-muted)' }}>Quote</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={status === "quoting"}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
          aria-label="Refresh price now"
        >
          <RefreshCw
            size={11}
            className={status === "quoting" ? "animate-spin" : ""}
          />
          {status === "quoting"
            ? "Refreshing…"
            : secondsLeft > 0
            ? `Refresh · ${secondsLeft}s`
            : "Refresh"}
        </button>
      </div>
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
              1 {fromSymbol} ≈ {formatAmount(rate, toToken.decimals)}{" "}
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
  );
}
