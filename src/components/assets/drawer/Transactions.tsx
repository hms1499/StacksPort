"use client";

import { ArrowUpRight, ArrowDownLeft, Code2, ExternalLink, Clock } from "lucide-react";
import { useTokenTransactions, type TokenTxRow } from "@/hooks/useMarketData";
import { useWalletStore } from "@/store/walletStore";
import { type TokenWithValue } from "@/lib/stacks";

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTxAmount(amount: number, symbol: string): string {
  const abs = Math.abs(amount);
  let s: string;
  if (abs === 0) s = "0";
  else if (abs >= 1000) s = abs.toLocaleString("en-US", { maximumFractionDigits: 2 });
  else if (abs >= 1) s = abs.toFixed(4);
  else if (abs >= 0.0001) s = abs.toFixed(6);
  else s = abs.toExponential(2);
  return `${amount < 0 ? "−" : "+"}${s} ${symbol}`;
}

function TokenTxRowView({ row }: { row: TokenTxRow }) {
  const isIn = row.direction === "in";
  const Icon = row.contractCall ? Code2 : isIn ? ArrowDownLeft : ArrowUpRight;
  const iconColor = row.contractCall
    ? "text-blue-500"
    : isIn
      ? "text-green-500"
      : "text-red-500";

  const label = row.contractCall
    ? row.contractCall.functionName
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : isIn
      ? `Received ${row.symbol}`
      : `Sent ${row.symbol}`;

  const sublabel = row.contractCall
    ? row.contractCall.contractId.split(".")[1] ?? ""
    : row.counterpart
      ? `${isIn ? "From" : "To"} ${row.counterpart.slice(0, 6)}…${row.counterpart.slice(-4)}`
      : "—";

  return (
    <a
      href={`https://explorer.hiro.so/txid/${row.txId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl transition-colors group"
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <Icon size={14} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {sublabel}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        {row.amount != null && row.amount !== 0 && (
          <p className={`text-xs font-medium ${isIn ? "text-green-500" : "text-red-500"}`}>
            {formatTxAmount(row.amount, row.symbol)}
          </p>
        )}
        <p className="text-[11px] flex items-center justify-end gap-0.5" style={{ color: "var(--text-muted)" }}>
          <Clock size={9} />
          {row.timestamp > 0 ? timeAgo(row.timestamp) : "—"}
        </p>
      </div>
      <ExternalLink
        size={11}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        style={{ color: "var(--text-muted)" }}
      />
    </a>
  );
}

export default function Transactions({
  token,
  isSTX,
}: {
  token: TokenWithValue;
  isSTX: boolean;
}) {
  const { stxAddress, isConnected } = useWalletStore();
  const contractKey = isSTX ? "stx" : token.contractId;
  const { data, isLoading } = useTokenTransactions(
    isConnected && stxAddress ? stxAddress : undefined,
    contractKey || undefined,
    { decimals: token.decimals, symbol: token.symbol, limit: 8 }
  );

  const rows = data?.results ?? [];

  return (
    <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-xs uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Recent Activity
        </p>
        {isConnected && stxAddress && (
          <a
            href={`https://explorer.hiro.so/address/${stxAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-[11px]"
            style={{ color: "var(--accent)" }}
          >
            All <ExternalLink size={10} />
          </a>
        )}
      </div>

      {isLoading && !data ? (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-10 rounded-xl animate-pulse"
              style={{ backgroundColor: "var(--border-subtle)" }}
              aria-hidden
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs py-3 text-center" style={{ color: "var(--text-muted)" }}>
          No {token.symbol} activity yet
        </p>
      ) : (
        <div className="space-y-0.5">
          {rows.map((row) => (
            <TokenTxRowView key={row.txId} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
