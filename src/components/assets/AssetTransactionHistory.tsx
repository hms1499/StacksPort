"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Code2,
  Layers,
  Clock,
  ExternalLink,
  Activity,
  ChevronDown,
  Download,
} from "lucide-react";
import { downloadCSV, csvDate } from "@/lib/export";
import { useWalletStore } from "@/store/walletStore";
import { getTransactions } from "@/lib/stacks";

type TxType = "send" | "receive" | "contract_call" | "smart_contract" | "coinbase";
type TxStatus = "success" | "pending" | "failed";
type FilterTab = "all" | "transfer" | "contract" | "failed";

interface TxItem {
  txId: string;
  type: TxType;
  status: TxStatus;
  label: string;
  sublabel: string;
  amount: string | null;
  timestamp: number;
}

const PAGE_SIZE = 15;

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatMicroSTX(amount: string): string {
  const stx = Number(amount) / 1_000_000;
  return `${stx.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} STX`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTx(raw: any, myAddress: string): TxItem {
  const tx = raw.tx ?? raw;
  const type = tx.tx_type;
  const status: TxStatus =
    tx.tx_status === "success"
      ? "success"
      : tx.tx_status === "pending"
      ? "pending"
      : "failed";
  const timestamp = tx.block_time ?? tx.burn_block_time ?? 0;

  if (type === "token_transfer") {
    const isSend = tx.sender_address === myAddress;
    const counterpart = isSend
      ? tx.token_transfer?.recipient_address
      : tx.sender_address;
    const short = counterpart
      ? `${counterpart.slice(0, 8)}...${counterpart.slice(-4)}`
      : "—";
    return {
      txId: tx.tx_id,
      type: isSend ? "send" : "receive",
      status,
      label: isSend ? "Sent STX" : "Received STX",
      sublabel: isSend ? `To ${short}` : `From ${short}`,
      amount: tx.token_transfer?.amount ?? null,
      timestamp,
    };
  }

  if (type === "contract_call") {
    const fn = tx.contract_call?.function_name ?? "call";
    const contract =
      tx.contract_call?.contract_id?.split(".")[1] ??
      tx.contract_call?.contract_id ??
      "";
    return {
      txId: tx.tx_id,
      type: "contract_call",
      status,
      label: fn
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase()),
      sublabel: contract,
      amount: null,
      timestamp,
    };
  }

  if (type === "smart_contract") {
    return {
      txId: tx.tx_id,
      type: "smart_contract",
      status,
      label: "Deploy Contract",
      sublabel: tx.smart_contract?.contract_id?.split(".")[1] ?? "",
      amount: null,
      timestamp,
    };
  }

  return {
    txId: tx.tx_id,
    type: "coinbase",
    status,
    label: "Coinbase",
    sublabel: `Block ${tx.block_height ?? ""}`,
    amount: null,
    timestamp,
  };
}

const TYPE_STYLES: Record<TxType, { icon: React.ElementType; bg: string; color: string }> = {
  send: { icon: ArrowUpRight, bg: "bg-red-50", color: "text-red-500" },
  receive: { icon: ArrowDownLeft, bg: "bg-green-50", color: "text-green-500" },
  contract_call: { icon: Code2, bg: "bg-blue-50", color: "text-blue-500" },
  smart_contract: { icon: Layers, bg: "bg-purple-50", color: "text-purple-500" },
  coinbase: { icon: Layers, bg: "bg-gray-50", color: "text-gray-400" },
};

const STATUS_DOT: Record<TxStatus, string> = {
  success: "bg-green-400",
  pending: "bg-yellow-400",
  failed: "bg-red-400",
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "transfer", label: "Transfer" },
  { key: "contract", label: "Contract" },
  { key: "failed", label: "Failed" },
];

function matchesFilter(tx: TxItem, filter: FilterTab): boolean {
  if (filter === "all") return true;
  if (filter === "transfer") return tx.type === "send" || tx.type === "receive";
  if (filter === "contract") return tx.type === "contract_call" || tx.type === "smart_contract";
  if (filter === "failed") return tx.status === "failed";
  return true;
}

function TxRow({ tx }: { tx: TxItem }) {
  const { icon: Icon, bg, color } = TYPE_STYLES[tx.type];
  return (
    <a
      href={`https://explorer.hiro.so/txid/${tx.txId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 py-3.5 px-6 hover:bg-gray-50 transition-colors group"
    >
      <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={color} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900 truncate">{tx.label}</p>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[tx.status]}`} />
        </div>
        <p className="text-xs text-gray-400 truncate">{tx.sublabel}</p>
      </div>

      {tx.amount && (
        <p
          className={`text-sm font-medium flex-shrink-0 ${
            tx.type === "send" ? "text-red-500" : "text-green-500"
          }`}
        >
          {tx.type === "send" ? "−" : "+"}
          {formatMicroSTX(tx.amount)}
        </p>
      )}

      <div className="flex items-center gap-3 flex-shrink-0">
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Clock size={10} />
          {tx.timestamp > 0 ? timeAgo(tx.timestamp) : "—"}
        </p>
        <ExternalLink
          size={12}
          className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
    </a>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3.5 px-6 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded w-32" />
        <div className="h-3 bg-gray-100 rounded w-48" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-20" />
      <div className="h-3 bg-gray-100 rounded w-12" />
    </div>
  );
}

export default function AssetTransactionHistory() {
  const { stxAddress, isConnected } = useWalletStore();
  const [allTxs, setAllTxs] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<FilterTab>("all");

  const fetchTxs = useCallback(
    async (currentOffset: number, append: boolean) => {
      if (!isConnected || !stxAddress) return;
      if (append) setLoadingMore(true); else setLoading(true);

      try {
        const data = await getTransactions(stxAddress, PAGE_SIZE, currentOffset);
        const results: TxItem[] = (data.results ?? []).map((r: unknown) =>
          parseTx(r, stxAddress)
        );
        setAllTxs((prev) => (append ? [...prev, ...results] : results));
        setHasMore(results.length === PAGE_SIZE);
        setOffset(currentOffset + results.length);
      } catch (e) {
        console.error(e);
      } finally {
        if (append) setLoadingMore(false); else setLoading(false);
      }
    },
    [stxAddress, isConnected]
  );

  useEffect(() => {
    setAllTxs([]);
    setOffset(0);
    setHasMore(true);
    fetchTxs(0, false);
  }, [fetchTxs]);

  const filtered = allTxs.filter((tx) => matchesFilter(tx, filter));

  const handleExport = useCallback(() => {
    const headers = ["Date", "Type", "Status", "Description", "Details", "Amount (STX)", "TX ID"];
    const rows = filtered.map((tx) => [
      tx.timestamp > 0
        ? new Date(tx.timestamp * 1000).toISOString().replace("T", " ").slice(0, 19)
        : "",
      tx.type,
      tx.status,
      tx.label,
      tx.sublabel,
      tx.amount ? (Number(tx.amount) / 1_000_000).toFixed(6) : "",
      tx.txId,
    ]);
    downloadCSV(`transactions-${csvDate()}.csv`, [headers, ...rows]);
  }, [filtered]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <h2 className="font-semibold text-gray-700">Transaction History</h2>
        {isConnected && stxAddress && (
          <div className="flex items-center gap-3">
            {filtered.length > 0 && (
              <button
                onClick={handleExport}
                title="Export CSV"
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#285A48] bg-gray-50 hover:bg-[#B0E4CC]/20 px-2 py-1 rounded-lg transition-colors"
              >
                <Download size={11} />
                Export
              </button>
            )}
            <a
              href={`https://explorer.hiro.so/address/${stxAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[#408A71] hover:text-[#285A48] transition-colors"
            >
              View on Explorer <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-6 py-3 border-b border-gray-50">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? allTxs.length
              : allTxs.filter((tx) => matchesFilter(tx, tab.key)).length;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filter === tab.key
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`text-[10px] px-1 rounded ${
                    filter === tab.key ? "bg-white/20" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity size={36} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Connect your wallet to view history</p>
        </div>
      ) : loading ? (
        <div className="divide-y divide-gray-50">
          {[...Array(8)].map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity size={36} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No transactions found</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {filtered.map((tx) => (
              <TxRow key={tx.txId} tx={tx} />
            ))}
          </div>

          {hasMore && (
            <div className="px-6 py-4 border-t border-gray-50">
              <button
                onClick={() => fetchTxs(offset, true)}
                disabled={loadingMore}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="animate-pulse">Loading...</span>
                ) : (
                  <>
                    <ChevronDown size={15} />
                    Load More
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
