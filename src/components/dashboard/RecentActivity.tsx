"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownLeft, Code2, Layers, Clock, ExternalLink, Sparkles, Wallet } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useTransactions } from "@/hooks/useMarketData";
import EmptyState from "@/components/motion/EmptyState";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";

interface TxItem {
  txId: string;
  type: "send" | "receive" | "contract_call" | "smart_contract" | "coinbase";
  status: "success" | "pending" | "failed";
  label: string;
  sublabel: string;
  amount: string | null;
  timestamp: number;
  protocol?: { name: string; color: string };
}

const DCA_VAULT = "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";

function detectProtocol(contractId: string): TxItem["protocol"] {
  if (!contractId) return undefined;
  const id = contractId.toLowerCase();
  const name = id.split(".")[1] ?? "";
  if (contractId.startsWith(DCA_VAULT)) return { name: "DCA Vault", color: "#FFB547" };
  if (name.includes("xyk") || name.includes("bitflow") || name.includes("aggregator") || name.includes("multihop"))
    return { name: "Bitflow", color: "#6366F1" };
  if (name.includes("alex") || name.includes("amm-pool")) return { name: "ALEX", color: "#22D3EE" };
  if (name.includes("pox") || name.includes("stack")) return { name: "Stacking", color: "#F472B6" };
  if (name.includes("sbtc")) return { name: "sBTC", color: "#F7931A" };
  return undefined;
}

function groupBucket(ts: number): "Today" | "Yesterday" | "This Week" | "Earlier" {
  if (!ts) return "Earlier";
  const now = new Date();
  const txDate = new Date(ts * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400 * 1000;
  const startOfWeek = startOfToday - 7 * 86400 * 1000;
  const t = txDate.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfYesterday) return "Yesterday";
  if (t >= startOfWeek) return "This Week";
  return "Earlier";
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() / 1000) - ts);
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
  const status = tx.tx_status === "success" ? "success" : tx.tx_status === "pending" ? "pending" : "failed";
  const timestamp = tx.block_time ?? tx.burn_block_time ?? 0;

  if (type === "token_transfer") {
    const isSend = tx.sender_address === myAddress;
    const counterpart = isSend
      ? tx.token_transfer?.recipient_address
      : tx.sender_address;
    const short = counterpart ? `${counterpart.slice(0, 6)}...${counterpart.slice(-4)}` : "—";
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
    const fullId = tx.contract_call?.contract_id ?? "";
    const contract = fullId.split(".")[1] ?? fullId;
    return {
      txId: tx.tx_id,
      type: "contract_call",
      status,
      label: fn.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      sublabel: contract,
      amount: null,
      timestamp,
      protocol: detectProtocol(fullId),
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

const TYPE_STYLES = {
  send:          { icon: ArrowUpRight,  bg: "bg-red-50",    color: "text-red-500"    },
  receive:       { icon: ArrowDownLeft, bg: "bg-green-50",  color: "text-green-500"  },
  contract_call: { icon: Code2,         bg: "bg-blue-50",   color: "text-blue-500"   },
  smart_contract:{ icon: Layers,        bg: "bg-purple-50", color: "text-purple-500" },
  coinbase:      { icon: Layers,        bg: "",             color: "text-gray-400"   },
};

const STATUS_DOT: Record<string, string> = {
  success: "bg-green-400",
  pending: "bg-yellow-400",
  failed: "bg-red-400",
};

const TxRow = React.memo(function TxRow({ tx }: { tx: TxItem }) {
  const { icon: Icon, bg, color } = TYPE_STYLES[tx.type];
  return (
    <a
      href={`https://explorer.hiro.so/txid/${tx.txId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl transition-colors group"
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <div
        className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center shrink-0`}
        style={bg ? undefined : { backgroundColor: 'var(--bg-elevated)' }}
      >
        <Icon size={15} className={color} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{tx.label}</p>
          {tx.protocol && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ color: tx.protocol.color, backgroundColor: `${tx.protocol.color}1A` }}
            >
              {tx.protocol.name}
            </span>
          )}
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[tx.status]} ${tx.status === "pending" ? "animate-pulse" : ""}`} />
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{tx.sublabel}</p>
      </div>

      <div className="text-right flex-shrink-0">
        {tx.amount && (
          <p className={`text-xs font-medium ${tx.type === "send" ? "text-red-500" : "text-green-500"}`}>
            {tx.type === "send" ? "−" : "+"}{formatMicroSTX(tx.amount)}
          </p>
        )}
        <p className="text-xs text-gray-400 flex items-center justify-end gap-0.5">
          <Clock size={9} />
          {tx.timestamp > 0 ? timeAgo(tx.timestamp) : "—"}
        </p>
      </div>

      <ExternalLink size={11} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </a>
  );
});

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5 px-2">
      <div className="w-9 h-9 rounded-full shrink-0 skeleton" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 rounded w-24 skeleton" />
        <div className="h-3 rounded w-32 skeleton" />
      </div>
      <div className="space-y-1.5 text-right">
        <div className="h-3 rounded w-16 ml-auto skeleton" />
        <div className="h-3 rounded w-10 ml-auto skeleton" />
      </div>
    </div>
  );
}

function RecentActivity() {
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: txData, isLoading } = useTransactions(addr);

  const txs: TxItem[] = (txData?.results ?? []).map((r: unknown) =>
    parseTx(r, stxAddress ?? "")
  );

  const grouped = useMemo(() => {
    const order: Array<"Today" | "Yesterday" | "This Week" | "Earlier"> = [
      "Today", "Yesterday", "This Week", "Earlier",
    ];
    const buckets: Record<string, TxItem[]> = {};
    for (const tx of txs) {
      const k = groupBucket(tx.timestamp);
      (buckets[k] ??= []).push(tx);
    }
    return order.filter((k) => buckets[k]?.length).map((k) => ({ label: k, items: buckets[k] }));
  }, [txs]);

  return (
    <div
      className="glass-card rounded-2xl p-5 shadow-sm flex flex-col"
      style={{ ['--card-accent' as string]: '#FB923C' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Activity</h2>
        {isConnected && stxAddress && (
          <a
            href={`https://explorer.hiro.so/address/${stxAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-xs transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            See all <ExternalLink size={11} />
          </a>
        )}
      </div>

      {!isConnected ? (
        <EmptyState
          icon={<Wallet size={28} style={{ color: 'var(--accent)' }} />}
          title="Connect to see your history"
          description="Your swaps, transfers, and DCA executions will show up here in real time."
          action={<ConnectWalletCTA />}
        />
      ) : isLoading ? (
        <div className="space-y-1">
          {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : txs.length === 0 ? (
        <EmptyState
          accentColor="#F7931A"
          icon={<Sparkles size={28} style={{ color: '#F7931A' }} />}
          title="A clean slate"
          description="Your first swap, transfer, or DCA execution will appear here."
          action={
            <Link
              href="/trade"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: '#F7931A',
                color: '#1a0f00',
                boxShadow: '0 0 14px rgba(247, 147, 26, 0.35)',
              }}
            >
              Make your first swap
              <ArrowUpRight size={14} />
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.label}>
              <div
                className="text-[10px] font-bold tracking-widest uppercase mb-1 px-2"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
              >
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((tx) => <TxRow key={tx.txId} tx={tx} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(RecentActivity);
