"use client";

import { Code2, ExternalLink } from "lucide-react";
import { timeAgo, truncateContractId } from "@/lib/utils";

interface UnknownContractRowProps {
  contractId: string;
  lastInteractedAt: number;
}

export default function UnknownContractRow({
  contractId,
  lastInteractedAt,
}: UnknownContractRowProps) {
  const explorerUrl = `https://explorer.hiro.so/address/${contractId}?chain=mainnet`;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <Code2 size={15} style={{ color: "var(--text-muted)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-mono truncate"
          style={{ color: "var(--text-secondary)" }}
        >
          {truncateContractId(contractId)}
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {lastInteractedAt > 0 ? timeAgo(lastInteractedAt) : "—"}
        </p>
      </div>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 transition-opacity hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
        title="View on Stacks Explorer"
      >
        <ExternalLink size={15} />
      </a>
    </div>
  );
}
