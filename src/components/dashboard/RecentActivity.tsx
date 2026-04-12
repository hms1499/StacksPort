"use client";

import React from "react";
import { ArrowUpRight, ArrowDownLeft, Code2, Layers, Clock, ExternalLink, Activity, Wallet } from "lucide-react";
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
    const contract = tx.contract_call?.contract_id?.split(".")[1] ?? tx.contract_call?.contract_id ?? "";
    return {
      txId: tx.tx_id,
      type: "contract_call",
      status,
      label: fn.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
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

const TYPE_STYLES = {
  send: { icon: ArrowUpRight, bg: "bg-red-50 dark:bg-red-900/20", color: "text-red-500" },
  receive: { icon: ArrowDownLeft, bg: "bg-green-50 dark:bg-green-900/20", color: "text-green-500" },
  contract_call: { icon: Code2, bg: "bg-blue-50 dark:bg-blue-900/20", color: "text-blue-500" },
  smart_contract: { icon: Layers, bg: "bg-purple-50 dark:bg-purple-900/20", color: "text-purple-500" },
  coinbase: { icon: Layers, bg: "bg-gray-50 dark:bg-gray-700", color: "text-gray-400" },
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
      <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={15} className={color} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{tx.label}</p>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[tx.status]}`} />
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
    <div className="flex items-center gap-3 py-2.5 px-2 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24" />
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-32" />
      </div>
      <div className="space-y-1.5 text-right">
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-16 ml-auto" />
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-10 ml-auto" />
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

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm flex flex-col">
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
          title="No wallet connected"
          description="Connect your wallet to view recent transactions."
          action={<ConnectWalletCTA />}
        />
      ) : isLoading ? (
        <div className="space-y-1">
          {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : txs.length === 0 ? (
        <EmptyState
          icon={<Activity size={28} style={{ color: 'var(--accent)' }} />}
          title="No transactions yet"
          description="Your transaction history will appear here once you make your first swap or transfer."
        />
      ) : (
        <div className="space-y-0.5">
          {txs.map((tx) => <TxRow key={tx.txId} tx={tx} />)}
        </div>
      )}
    </div>
  );
}

export default React.memo(RecentActivity);
