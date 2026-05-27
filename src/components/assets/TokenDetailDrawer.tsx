"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowUpRight, ArrowDownLeft, Repeat, Bell, Copy, Check, TrendingUp, TrendingDown, ExternalLink, Lock, Bitcoin } from "lucide-react";
import { getGeckoIdForContract, type TokenWithValue } from "@/lib/stacks";
import TokenPnL from "./drawer/PnL";
import { useSBTCDataSnap } from "@/hooks/usePortfolioSnapshot";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { openSTXTransfer, openContractCall } from "@stacks/connect";
import { uintCV, standardPrincipalCV, noneCV, PostConditionMode } from "@stacks/transactions";
import { trackTx } from "@/lib/tx-tracker";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import TokenPriceChart from "./drawer/PriceChart";
import TokenMarketStats24h from "./drawer/MarketStats";
import TokenTransactions from "./drawer/Transactions";
import {
  SWAP_TOKENS,
  getValidDestinations,
  getQuote,
  sanitizeAmountInput,
  type SwapToken,
} from "@/lib/direct-swap";

interface Props {
  token: TokenWithValue | null;
  totalUsd: number;
  onClose: () => void;
  onSend: (t: TokenWithValue) => void;
  onReceive: () => void;
}

function formatBalance(n: number): string {
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n >= 1) return n.toFixed(6);
  return n.toFixed(8);
}

function formatPrice(n: number): string {
  if (n === 0) return "—";
  if (n >= 1000) return formatUSD(n);
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

function truncateMiddle(s: string, head = 14, tail = 10): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export default function TokenDetailDrawer({ token, totalUsd, onClose, onSend, onReceive }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // ESC closes. Mounted only while a token is selected so we don't leak the
  // global listener when the drawer is closed.
  useEffect(() => {
    if (!token) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [token, onClose]);

  if (!token) return null;

  const pct = totalUsd > 0 ? (token.valueUsd / totalUsd) * 100 : 0;
  const change24h = token.change24h;
  const isPositive = (change24h ?? 0) >= 0;
  const isSTX = !token.contractId || token.contractId === "stx";
  const geckoId = getGeckoIdForContract(token.contractId);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(token.contractId || "STX");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; silently ignore — user can still read the id
    }
  };

  const onSwap = () => {
    // Pass contract id so /trade can preselect; STX uses the literal "stx"
    // marker that the swap widget already recognises.
    const from = isSTX ? "stx" : token.contractId;
    router.push(`/trade?from=${encodeURIComponent(from)}`);
    onClose();
  };

  const onAlert = () => {
    router.push(`/notifications?token=${encodeURIComponent(token.symbol)}`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="token-drawer-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-sm transition-opacity"
      />

      {/* Sheet */}
      <div
        className="w-full sm:max-w-md ml-auto h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        style={{ backgroundColor: "var(--bg-card)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {token.imageUri ? (
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={token.imageUri} alt={token.symbol} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#B0E4CC]/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[#285A48]">
                  {token.symbol.slice(0, 3)}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h2
                id="token-drawer-title"
                className="text-base font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {token.symbol}
              </h2>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {token.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Balance */}
        <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Your Balance
          </p>
          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {formatBalance(token.balance)} {token.symbol}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {token.valueUsd > 0 ? formatUSD(token.valueUsd) : "—"}
            </span>
            {pct > 0 && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                · {pct.toFixed(1)}% of portfolio
              </span>
            )}
          </div>
        </div>

        {/* PnL (cost basis, unrealized, realized) — only when an entry exists */}
        <TokenPnL token={token} isSTX={isSTX} />

        {/* Stacking / yield info for stSTX & sBTC */}
        <TokenYieldInfo token={token} />

        {/* Price + chart */}
        <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                Price
              </p>
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {formatPrice(token.priceUsd)}
              </p>
            </div>
            {change24h !== null && (
              <span
                className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}
              >
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isPositive ? "+" : ""}
                {change24h.toFixed(2)}%
                <span className="text-xs font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>
                  24h
                </span>
              </span>
            )}
          </div>
          {geckoId && (
            <div className="mt-4">
              <TokenPriceChart geckoId={geckoId} symbol={token.symbol} />
            </div>
          )}
          {geckoId && <TokenMarketStats24h geckoId={geckoId} />}
        </div>

        {/* Inline quick-swap (only for tokens with a route in the swap registry) */}
        <InlineQuickSwap token={token} isSTX={isSTX} onClose={onClose} />

        {/* Inline quick-send */}
        <InlineQuickSend token={token} isSTX={isSTX} />

        {/* Recent token activity */}
        <TokenTransactions
          token={token}
          isSTX={isSTX}
        />

        {/* Actions */}
        <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="grid grid-cols-4 gap-2">
            <ActionButton icon={<Repeat size={16} />} label="Swap" onClick={onSwap} />
            <ActionButton icon={<ArrowUpRight size={16} />} label="Send" onClick={() => onSend(token)} />
            <ActionButton icon={<ArrowDownLeft size={16} />} label="Receive" onClick={onReceive} />
            <ActionButton icon={<Bell size={16} />} label="Alert" onClick={onAlert} />
          </div>
        </div>

        {/* Meta */}
        <div className="p-5 mt-auto">
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
            Token Details
          </p>
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt style={{ color: "var(--text-muted)" }}>Contract</dt>
              <dd className="flex items-center gap-1.5 font-mono" style={{ color: "var(--text-secondary)" }}>
                <span className="truncate" title={token.contractId}>
                  {truncateMiddle(token.contractId || "STX (native)")}
                </span>
                {token.contractId && (
                  <button
                    type="button"
                    onClick={onCopy}
                    className="p-1 rounded transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                    aria-label="Copy contract id"
                  >
                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  </button>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt style={{ color: "var(--text-muted)" }}>Decimals</dt>
              <dd className="font-mono" style={{ color: "var(--text-secondary)" }}>{token.decimals}</dd>
            </div>
            {token.warning && (
              <div className="flex items-center justify-between">
                <dt style={{ color: "var(--text-muted)" }}>Status</dt>
                <dd
                  className={`font-medium ${token.warning === "suspicious" ? "text-red-500" : "text-yellow-600"}`}
                >
                  {token.warning === "suspicious" ? "Suspicious" : "Unverified"}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

type SendStatus = "idle" | "loading" | "success" | "error";

function InlineQuickSend({
  token,
  isSTX,
}: {
  token: TokenWithValue;
  isSTX: boolean;
}) {
  const { stxAddress, network, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [txId, setTxId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isConnected || !stxAddress) return null;

  const addrPrefix = network === "mainnet" ? "SP" : "ST";
  const numAmount = Number(amount);
  const exceedsBalance = numAmount > token.balance;

  const validate = (): string | null => {
    if (!recipient.startsWith(addrPrefix)) return `Address must start with "${addrPrefix}"`;
    if (recipient.length < 30) return "Invalid address";
    if (!Number.isFinite(numAmount) || numAmount <= 0) return "Enter a valid amount";
    if (exceedsBalance) return "Amount exceeds balance";
    return null;
  };

  const onSend = async () => {
    const err = validate();
    if (err) {
      setErrorMsg(err);
      setStatus("error");
      return;
    }
    setErrorMsg(null);
    setStatus("loading");

    const rawAmount = BigInt(Math.floor(numAmount * Math.pow(10, token.decimals)));

    const onFinish = ({ txId: id }: { txId: string }) => {
      setTxId(id);
      setStatus("success");
      addNotification(
        `Transfer submitted: ${amount} ${token.symbol}`,
        "info",
        "send",
        5000,
        { txId: id, amount, tokenSymbol: token.symbol }
      );
      trackTx({
        txId: id,
        label: `Transfer ${amount} ${token.symbol}`,
        category: "send",
        context: { txId: id, amount, tokenSymbol: token.symbol },
        addNotification,
        address: stxAddress,
      });
    };

    try {
      if (isSTX) {
        await openSTXTransfer({
          recipient,
          amount: rawAmount,
          memo: "",
          network,
          onFinish,
          onCancel: () => setStatus("idle"),
        });
      } else {
        const [contractAddress, rest] = (token.contractId || "").split(".");
        const contractName = rest?.split("::")[0] ?? "";
        await openContractCall({
          contractAddress,
          contractName,
          functionName: "transfer",
          functionArgs: [
            uintCV(rawAmount),
            standardPrincipalCV(stxAddress),
            standardPrincipalCV(recipient),
            noneCV(),
          ],
          postConditionMode: PostConditionMode.Allow,
          network,
          onFinish,
          onCancel: () => setStatus("idle"),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setErrorMsg(msg);
      setStatus("error");
      addNotification(`Transfer failed: ${msg}`, "error", "send", 5000);
    }
  };

  const onMax = () => setAmount(String(token.balance));

  if (status === "success" && txId) {
    return (
      <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div
          className="flex items-center gap-3 rounded-xl p-3"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        >
          <CheckCircle2 size={20} className="text-green-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Transfer submitted
            </p>
            <a
              href={`https://explorer.hiro.so/txid/${txId}?chain=${network}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] underline truncate block"
              style={{ color: "var(--accent)" }}
            >
              View on Explorer
            </a>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setTxId(null);
              setRecipient("");
              setAmount("");
            }}
            className="text-xs font-semibold px-2 py-1 rounded-md"
            style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            New
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <p
        className="text-xs uppercase tracking-wide mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        Quick Send
      </p>

      <input
        type="text"
        value={recipient}
        onChange={(e) => {
          setRecipient(e.target.value.trim());
          if (errorMsg) setErrorMsg(null);
          if (status === "error") setStatus("idle");
        }}
        placeholder={`${addrPrefix}…`}
        className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
        style={{
          backgroundColor: "var(--bg-elevated)",
          color: "var(--text-primary)",
        }}
        aria-label="Recipient address"
      />

      <div
        className="rounded-xl p-3 mt-2 flex items-center gap-2"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            setAmount(v);
            if (errorMsg) setErrorMsg(null);
            if (status === "error") setStatus("idle");
          }}
          placeholder="0.0"
          className="flex-1 bg-transparent outline-none text-base font-mono"
          style={{ color: "var(--text-primary)" }}
          aria-label={`Amount in ${token.symbol}`}
        />
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {token.symbol}
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
          MAX
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 min-h-[18px] text-xs">
        <span style={{ color: "var(--text-muted)" }}>
          Balance: {formatBalance(token.balance)} {token.symbol}
        </span>
        {exceedsBalance && (
          <span className="text-red-500 font-medium">Exceeds balance</span>
        )}
      </div>

      {errorMsg && (
        <div
          className="flex items-center gap-2 text-xs mt-2 px-3 py-2 rounded-xl"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#EF4444" }}
        >
          <AlertCircle size={12} />
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        onClick={onSend}
        disabled={status === "loading"}
        className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        style={{ backgroundColor: "var(--accent)", color: "#0A1628" }}
      >
        {status === "loading" ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Waiting for wallet…
          </>
        ) : (
          <>
            <ArrowUpRight size={14} /> Send {token.symbol}
          </>
        )}
      </button>
    </div>
  );
}



function StSTXYieldCard({ token }: { token: TokenWithValue }) {
  // APY range mirrors YieldOpportunities — labelled "Estimated".
  const estApy = "7–9%";
  const stakedStxEquiv = token.balance > 0 ? token.balance : null; // ~1:1 receipt-to-STX claim

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid rgba(167, 139, 250, 0.25)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(167, 139, 250, 0.15)", color: "#A78BFA" }}
          >
            <Lock size={14} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Liquid Stacking
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              via StackingDAO
            </p>
          </div>
        </div>
        <span className="text-sm font-bold font-mono" style={{ color: "#A78BFA" }}>
          ~{estApy}
        </span>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        stSTX accrues PoX rewards automatically — its claim on STX grows each cycle.
        {stakedStxEquiv != null && (
          <>
            {" "}
            You hold ~<span className="font-mono">{stakedStxEquiv.toFixed(2)}</span> stSTX.
          </>
        )}
      </p>

      <div className="flex gap-2">
        <a
          href="https://stackingdao.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors"
          style={{ backgroundColor: "rgba(167, 139, 250, 0.15)", color: "#A78BFA" }}
        >
          Manage on StackingDAO <ExternalLink size={11} />
        </a>
      </div>

      <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
        APY estimate · varies by cycle
      </p>
    </div>
  );
}

function SBTCYieldCard() {
  const { stxAddress, isConnected } = useWalletStore();
  const router = useRouter();
  const { data: sbtc } = useSBTCDataSnap(
    isConnected && stxAddress ? stxAddress : undefined
  );

  const status = sbtc?.peg?.status ?? null;
  const deviation = sbtc?.peg?.deviation ?? null;
  const pegColor =
    status === "pegged" ? "#22C55E" : status === "slight" ? "#F59E0B" : status === "depegged" ? "#EF4444" : "var(--text-muted)";
  const pegLabel =
    status === "pegged"
      ? "Pegged"
      : status === "slight"
        ? "Slight drift"
        : status === "depegged"
          ? "Depegged"
          : "—";

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid rgba(247, 147, 26, 0.25)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(247, 147, 26, 0.15)", color: "#F7931A" }}
          >
            <Bitcoin size={14} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              sBTC Liquidity
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Bitflow / ALEX pools
            </p>
          </div>
        </div>
        <span className="text-sm font-bold font-mono" style={{ color: "#F7931A" }}>
          ~3–5%
        </span>
      </div>

      <div className="flex items-center justify-between text-xs mb-3">
        <span style={{ color: "var(--text-muted)" }}>Peg status</span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: pegColor }}
          />
          <span className="font-medium" style={{ color: pegColor }}>
            {pegLabel}
          </span>
          {deviation != null && Math.abs(deviation) >= 0.01 && (
            <span className="font-mono" style={{ color: "var(--text-muted)" }}>
              ({deviation > 0 ? "+" : ""}
              {deviation.toFixed(2)}%)
            </span>
          )}
        </span>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        sBTC isn’t yield-bearing on its own — supplying it to a DEX pool earns swap fees.
      </p>

      <button
        type="button"
        onClick={() => router.push("/trade?from=sbtc")}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors"
        style={{ backgroundColor: "rgba(247, 147, 26, 0.15)", color: "#F7931A" }}
      >
        Explore sBTC pools <ArrowUpRight size={11} />
      </button>

      <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
        APY estimate · pool depth dependent
      </p>
    </div>
  );
}

function TokenYieldInfo({ token }: { token: TokenWithValue }) {
  const isStSTX =
    token.symbol === "stSTX" ||
    (token.contractId?.split("::")[0].split(".")[1] === "ststx-token");
  const isSBTC =
    token.symbol === "sBTC" ||
    (token.contractId?.split("::")[0].split(".")[1] === "sbtc-token");

  if (!isStSTX && !isSBTC) return null;

  return (
    <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <p
        className="text-xs uppercase tracking-wide mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        Yield
      </p>
      {isStSTX ? <StSTXYieldCard token={token} /> : <SBTCYieldCard />}
    </div>
  );
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

function InlineQuickSwap({
  token,
  isSTX,
  onClose,
}: {
  token: TokenWithValue;
  isSTX: boolean;
  onClose: () => void;
}) {
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
        setError(e instanceof Error ? e.message : "Quote unavailable");
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [amount, fromToken, toId]);

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
          Quick Swap
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
          MAX
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 min-h-[18px] text-xs">
        <span style={{ color: "var(--text-muted)" }}>
          Balance: {formatBalance(balance)} {fromToken.symbol}
        </span>
        {overBalance ? (
          <span className="text-red-500 font-medium">Exceeds balance</span>
        ) : quoting ? (
          <span style={{ color: "var(--text-muted)" }}>Quoting…</span>
        ) : quoteOut != null && toToken ? (
          <span style={{ color: "var(--text-secondary)" }}>
            ≈ {formatOut(quoteOut)} {toToken.symbol}
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
        {amount && !overBalance ? `Continue to swap` : `Enter amount`}
      </button>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors"
      style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-subtle)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)")}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}
