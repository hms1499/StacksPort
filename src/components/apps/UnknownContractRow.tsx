"use client";

import { Code2, ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { useContractInfo } from "@/hooks/useMarketData";

interface UnknownContractRowProps {
  contractId: string;
  lastInteractedAt: number;
}

export default function UnknownContractRow({
  contractId,
  lastInteractedAt,
}: UnknownContractRowProps) {
  const explorerUrl = `https://explorer.hiro.so/address/${contractId}?chain=mainnet`;
  const contractName = contractId.split(".")[1] ?? contractId;
  const deployer = contractId.split(".")[0];
  const truncatedDeployer =
    deployer.length > 10
      ? `${deployer.slice(0, 6)}...${deployer.slice(-4)}`
      : deployer;

  const { data: contractInfo, isLoading } = useContractInfo(contractId);

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
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-secondary)" }}>
            {contractName}
          </p>
          <span
            className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: "rgba(245,158,11,0.15)",
              color: "#d97706",
            }}
            title="Contract not recognized as a known DeFi protocol"
          >
            Unverified
          </span>
        </div>

        {isLoading ? (
          <div
            className="mt-1 h-3 w-40 rounded animate-pulse"
            style={{ backgroundColor: "var(--border-subtle)" }}
          />
        ) : (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {truncatedDeployer} · {lastInteractedAt > 0 ? timeAgo(lastInteractedAt) : "—"}
            </p>
            {contractInfo?.sourceVerified && (
              <span
                className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: "var(--accent-dim)",
                  color: "var(--accent)",
                }}
              >
                Open Source
              </span>
            )}
          </div>
        )}
      </div>

      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 transition-opacity hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
        title="View on Stacks Explorer"
        aria-label={`Open ${contractName} on Stacks Explorer`}
      >
        <ExternalLink size={15} />
      </a>
    </div>
  );
}
