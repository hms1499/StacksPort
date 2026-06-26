"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ArrowUpDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  RefreshCw,
} from "lucide-react";
import { openContractCall } from "@stacks/connect";
import {
  PostConditionMode,
  contractPrincipalCV,
  uintCV,
  Pc,
  type ClarityValue,
} from "@stacks/transactions";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { TokenImage } from "@/components/ui";
import { trackTx } from "@/lib/tx-tracker";
import { formatAmount } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const CORE_ADDRESS = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const CORE_NAME = "stableswap-core-v-1-4";
const POOL_ADDRESS = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const POOL_NAME = "stableswap-pool-aeusdc-usdcx-v-1-1";

const AEUSDC_ADDRESS = "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K";
const AEUSDC_NAME = "token-aeusdc";
const AEUSDC_ASSET = "aeUSDC";

const USDCX_ADDRESS = "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE";
const USDCX_NAME = "usdcx";
const USDCX_ASSET = "usdcx-token";

const HIRO_API = "https://api.hiro.so";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchBalance(address: string, contractId: string): Promise<number> {
  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
  if (!res.ok) return 0;
  const data = await res.json();
  const fts = (data.fungible_tokens ?? {}) as Record<string, { balance: string }>;
  const match = Object.entries(fts).find(([k]) =>
    k.toLowerCase().startsWith(contractId.toLowerCase())
  );
  return match ? Number(match[1].balance) / 1e6 : 0;
}

// ─── Token badge ──────────────────────────────────────────────────────────────

function TokenBadge({ symbol, img }: { symbol: string; img: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <TokenImage src={img} symbol={symbol} size={20} fallback="none" />
      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{symbol}</span>
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Status = "idle" | "quoting" | "ready" | "swapping" | "success" | "error";
type Direction = "x-to-y" | "y-to-x"; // x = aeUSDC, y = USDCx

const AEUSDC_IMG = "https://assets.hiro.so/api/mainnet/token-metadata-api/SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc/1.png";
const USDCX_IMG = "https://assets.hiro.so/api/mainnet/token-metadata-api/SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx/1.png";

export default function MigrationWidget() {
  const { stxAddress, isConnected, network } = useWalletStore();
  const { addNotification } = useNotificationStore();

  const [direction, setDirection] = useState<Direction>("x-to-y");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.1);

  const [aeBalance, setAeBalance] = useState<number | null>(null);
  const [usdcxBalance, setUsdcxBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  // Bumped after a successful migration so the balance effect re-runs and
  // the widget shows the new post-swap balance immediately.
  const [balanceNonce, setBalanceNonce] = useState(0);

  const [output, setOutput] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic request id — only the latest in-flight quote may commit state,
  // so a slow earlier quote can't clobber a newer one.
  const quoteReqId = useRef(0);

  // Clear all form / status state on wallet switch or disconnect so a
  // previous user's success screen or quote doesn't leak to the next user.
  useEffect(() => {
    setAmount("");
    setOutput(null);
    setStatus("idle");
    setErrorMsg(null);
    setTxId(null);
  }, [stxAddress]);

  // Derived
  const fromSymbol = direction === "x-to-y" ? "aeUSDC" : "USDCx";
  const toSymbol = direction === "x-to-y" ? "USDCx" : "aeUSDC";
  const fromImg = direction === "x-to-y" ? AEUSDC_IMG : USDCX_IMG;
  const toImg = direction === "x-to-y" ? USDCX_IMG : AEUSDC_IMG;
  const fromBalance = direction === "x-to-y" ? aeBalance : usdcxBalance;

  // Fetch balances — also re-runs after a successful migration via balanceNonce
  useEffect(() => {
    if (!stxAddress) { setAeBalance(null); setUsdcxBalance(null); return; }
    setBalanceLoading(true);
    Promise.all([
      fetchBalance(stxAddress, `${AEUSDC_ADDRESS}.${AEUSDC_NAME}`),
      fetchBalance(stxAddress, `${USDCX_ADDRESS}.${USDCX_NAME}`),
    ])
      .then(([ae, usdcx]) => { setAeBalance(ae); setUsdcxBalance(usdcx); })
      .catch(() => { setAeBalance(null); setUsdcxBalance(null); })
      .finally(() => setBalanceLoading(false));
  }, [stxAddress, balanceNonce]);

  // Debounced quote
  const fetchQuote = useCallback(async (dir: Direction, amt: number) => {
    if (amt <= 0) { setOutput(null); setStatus("idle"); return; }
    const myReqId = ++quoteReqId.current;
    setStatus("quoting");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/stableswap/quote?direction=${dir}&amount=${amt}`);
      if (myReqId !== quoteReqId.current) return;
      const data: { output?: number; error?: string } = await res.json();
      if (myReqId !== quoteReqId.current) return;
      if (data.error) throw new Error(data.error);
      setOutput(data.output ?? null);
      setStatus(data.output != null ? "ready" : "idle");
    } catch (e) {
      if (myReqId !== quoteReqId.current) return;
      setOutput(null);
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to get quote");
    }
  }, []);

  useEffect(() => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt)) { setOutput(null); setStatus("idle"); return; }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => fetchQuote(direction, amt), 500);
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current); };
  }, [direction, amount, fetchQuote]);

  function flipDirection() {
    setDirection((d) => (d === "x-to-y" ? "y-to-x" : "x-to-y"));
    setAmount("");
    setOutput(null);
    setStatus("idle");
    setErrorMsg(null);
  }

  function setPercent(pct: number) {
    if (!fromBalance || fromBalance <= 0) return;
    setAmount(parseFloat((fromBalance * pct).toFixed(6)).toString());
  }

  // Execute swap
  async function handleSwap() {
    if (output === null || !stxAddress || status !== "ready") return;
    setStatus("swapping");
    setErrorMsg(null);

    try {
      // floor (not round) so amountMicro can never exceed the user's
      // displayed balance by 1 micro and trigger an on-chain post-condition
      // failure.
      const amountMicro = BigInt(Math.floor(parseFloat(amount) * 1e6));
      const minOutputMicro = BigInt(Math.floor(output * 1e6 * (1 - slippage / 100)));

      const poolCV = contractPrincipalCV(POOL_ADDRESS, POOL_NAME);
      const aeUSDCCV = contractPrincipalCV(AEUSDC_ADDRESS, AEUSDC_NAME);
      const usdcxCV = contractPrincipalCV(USDCX_ADDRESS, USDCX_NAME);

      let functionName: string;
      const functionArgs: ClarityValue[] = [poolCV, aeUSDCCV, usdcxCV, uintCV(amountMicro), uintCV(minOutputMicro)];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let postConditions: any[];

      if (direction === "x-to-y") {
        functionName = "swap-x-for-y";
        postConditions = [
          Pc.principal(stxAddress).willSendEq(amountMicro).ft(`${AEUSDC_ADDRESS}.${AEUSDC_NAME}`, AEUSDC_ASSET),
          Pc.principal(`${POOL_ADDRESS}.${POOL_NAME}`).willSendGte(minOutputMicro).ft(`${USDCX_ADDRESS}.${USDCX_NAME}`, USDCX_ASSET),
        ];
      } else {
        functionName = "swap-y-for-x";
        postConditions = [
          Pc.principal(stxAddress).willSendEq(amountMicro).ft(`${USDCX_ADDRESS}.${USDCX_NAME}`, USDCX_ASSET),
          Pc.principal(`${POOL_ADDRESS}.${POOL_NAME}`).willSendGte(minOutputMicro).ft(`${AEUSDC_ADDRESS}.${AEUSDC_NAME}`, AEUSDC_ASSET),
        ];
      }

      openContractCall({
        contractAddress: CORE_ADDRESS,
        contractName: CORE_NAME,
        functionName,
        functionArgs,
        postConditions,
        postConditionMode: PostConditionMode.Deny,
        network,
        onFinish: ({ txId: id }) => {
          setTxId(id);
          setStatus("success");
          trackTx({
            txId: id,
            label: `Migrate ${fromSymbol} → ${toSymbol}`,
            category: "swap",
            context: { txId: id, action: "migration", amount },
            addNotification,
            address: stxAddress,
          });
          // Re-fetch balances so the new post-swap amounts show up immediately.
          setBalanceNonce((n) => n + 1);
        },
        onCancel: () => setStatus("ready"),
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Swap failed");
      setStatus("error");
    }
  }

  const amountNum = parseFloat(amount) || 0;
  const overBalance = fromBalance !== null && amountNum > fromBalance && amountNum > 0;

  // ── Success ────────────────────────────────────────────────────────────────

  if (status === "success" && txId) {
    return (
      <div className="flex flex-col items-center py-8 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 size={30} className="text-green-500" />
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Migration Submitted!</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{fromSymbol} → {toSymbol}</p>
        </div>
        <a
          href={`https://explorer.hiro.so/txid/${txId}?chain=${network}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm underline"
          style={{ color: 'var(--accent-text)' }}
        >
          View on Explorer <ExternalLink size={12} />
        </a>
        <button
          onClick={() => { setStatus("idle"); setTxId(null); setAmount(""); setOutput(null); }}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--accent)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-dim)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)')}
        >
          New Migration
        </button>
      </div>
    );
  }

  // ── Main Form ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Migrate between <strong>aeUSDC</strong> (Allbridge) and <strong>USDCx</strong> (Circle xReserve) at near 1:1 via the Bitflow stableswap pool.
        </p>
      </div>

      {/* Direction toggle */}
      <div className="flex items-center gap-2 rounded-xl p-1" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        {(["x-to-y", "y-to-x"] as Direction[]).map((d) => (
          <button
            key={d}
            onClick={() => { setDirection(d); setAmount(""); setOutput(null); setStatus("idle"); setErrorMsg(null); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
            style={direction === d
              ? { backgroundColor: 'var(--bg-card)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: 'var(--text-primary)' }
              : { color: 'var(--text-muted)' }
            }
          >
            <TokenBadge symbol={d === "x-to-y" ? "aeUSDC" : "USDCx"} img={d === "x-to-y" ? AEUSDC_IMG : USDCX_IMG} />
            <span style={{ color: 'var(--border-default)' }}>→</span>
            <TokenBadge symbol={d === "x-to-y" ? "USDCx" : "aeUSDC"} img={d === "x-to-y" ? USDCX_IMG : AEUSDC_IMG} />
          </button>
        ))}
      </div>

      {/* From section */}
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TokenImage src={fromImg} symbol={fromSymbol} size={24} fallback="none" />
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{fromSymbol}</span>
          </div>
          {isConnected && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Balance:{" "}
              {balanceLoading ? (
                <span className="inline-block w-10 h-2.5 rounded animate-pulse align-middle" style={{ backgroundColor: 'var(--border-subtle)' }} />
              ) : fromBalance !== null ? (
                <button
                  onClick={() => setPercent(1)}
                  className="font-medium transition-colors"
                  style={{ color: 'var(--accent-text)' }}
                >
                  {formatAmount(fromBalance)} {fromSymbol}
                </button>
              ) : "—"}
            </span>
          )}
        </div>

        <div className="relative">
          <input
            type="number"
            placeholder="0.00"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${
              overBalance ? "border-red-300 focus:ring-red-300 text-red-600" : "focus:ring-[#B0E4CC]"
            }`}
            style={overBalance ? {} : {
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>
            ≈ ${amountNum > 0 ? amountNum.toFixed(2) : "0.00"}
          </span>
        </div>

        {overBalance && (
          <p className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle size={12} />
            Insufficient balance. Max: {formatAmount(fromBalance!)} {fromSymbol}
          </p>
        )}

        {isConnected && fromBalance !== null && fromBalance > 0 && (
          <div className="flex gap-1">
            {[0.25, 0.5, 1].map((pct) => (
              <button
                key={pct}
                onClick={() => setPercent(pct)}
                className="px-2 py-0.5 text-[11px] font-semibold rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-text)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
              >
                {pct === 1 ? "MAX" : `${pct * 100}%`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Flip button */}
      <div className="flex justify-center">
        <button
          onClick={flipDirection}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm"
          style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}
          title="Flip direction"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-dim)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-card)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
          }}
        >
          <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* To section */}
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TokenImage src={toImg} symbol={toSymbol} size={24} fallback="none" />
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{toSymbol}</span>
          </div>
          {isConnected && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Balance:{" "}
              {balanceLoading ? (
                <span className="inline-block w-10 h-2.5 rounded animate-pulse align-middle" style={{ backgroundColor: 'var(--border-subtle)' }} />
              ) : (direction === "x-to-y" ? usdcxBalance : aeBalance) !== null ? (
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {formatAmount(direction === "x-to-y" ? usdcxBalance! : aeBalance!)} {toSymbol}
                </span>
              ) : "—"}
            </span>
          )}
        </div>

        <div
          className="px-3.5 py-2.5 rounded-xl border min-h-10.5 flex items-center"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          {status === "quoting" ? (
            <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={13} className="animate-spin" /> Getting quote...
            </span>
          ) : output !== null ? (
            <div className="flex items-baseline gap-2 w-full">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatAmount(output)}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{toSymbol}</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>≈ ${output.toFixed(2)}</span>
            </div>
          ) : (
            <span className="text-sm" style={{ color: 'var(--border-default)' }}>—</span>
          )}
        </div>
      </div>

      {/* Details panel */}
      {output !== null && status !== "quoting" && (
        <div className="rounded-xl px-4 py-3 space-y-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Rate</span>
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              1 {fromSymbol} ≈ {amountNum > 0 ? formatAmount(output / amountNum) : "—"} {toSymbol}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Pool</span>
            <a
              href={`https://explorer.hiro.so/txid/${POOL_ADDRESS}.${POOL_NAME}?chain=${network}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 transition-colors"
              style={{ color: 'var(--accent-text)' }}
            >
              aeUSDC-USDCx-LP <ExternalLink size={10} />
            </a>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Slippage</span>
            <div className="flex gap-1">
              {[0.1, 0.5, 1].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className="px-2 py-0.5 rounded-lg font-medium transition-colors text-xs"
                  style={slippage === s
                    ? { backgroundColor: 'var(--accent)', color: '#fff' }
                    : { backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }
                  }
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Min received</span>
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              {formatAmount(output * (1 - slippage / 100))} {toSymbol}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && errorMsg && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50/80 rounded-xl px-3 py-2.5">
          <AlertCircle size={13} />
          {errorMsg}
        </div>
      )}

      {/* Wallet not connected */}
      {!isConnected && (
        <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2.5" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
          <Info size={13} />
          Connect your wallet to migrate
        </div>
      )}

      {/* Swap button */}
      <button
        onClick={handleSwap}
        disabled={!isConnected || status !== "ready" || overBalance || amountNum <= 0}
        className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--accent)' }}
        onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-dim)'; }}
        onMouseLeave={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
      >
        {status === "swapping" ? (
          <><Loader2 size={15} className="animate-spin" /> Waiting for wallet...</>
        ) : status === "quoting" ? (
          <><Loader2 size={15} className="animate-spin" /> Getting quote...</>
        ) : (
          <>
            <RefreshCw size={14} />
            Migrate {fromSymbol} → {toSymbol}
          </>
        )}
      </button>

      <p className="text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Powered by{" "}
        <a href="https://bitflow.finance" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-dim)' }}>
          Bitflow
        </a>
        {" "}stableswap pool
      </p>
    </div>
  );
}
