"use client";

import { ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { ProtocolPosition } from "@/lib/protocol-positions";

interface ProtocolCardProps {
  name: string;
  logoUrl: string;
  url: string;
  category: string;
  lastInteractedAt: number;
  position?: ProtocolPosition | null | "loading";
}

function PositionRow({ position }: { position: ProtocolPosition | null | "loading" }) {
  if (position === "loading") {
    return (
      <div
        className="flex flex-col gap-1.5 py-2 border-t border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div
          className="h-2.5 rounded animate-pulse"
          style={{ backgroundColor: "var(--bg-muted)", width: "55%" }}
        />
        <div
          className="h-2.5 rounded animate-pulse"
          style={{ backgroundColor: "var(--bg-muted)", width: "40%" }}
        />
      </div>
    );
  }

  if (position === null) {
    return (
      <div
        className="py-2 border-t border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
          title="Unable to fetch position"
        >
          —
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-1 py-2 border-t border-b"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      {position.lines.map((line) => (
        <div key={line.label} className="flex items-center justify-between gap-2">
          <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
            {line.label}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-xs truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {line.tokenAmount}
            </span>
            <span
              className="text-xs font-medium shrink-0"
              style={{ color: "var(--text-primary)" }}
            >
              ${line.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ))}
      {position.lines.length > 1 && (
        <div
          className="flex items-center justify-between pt-1 mt-0.5 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {position.totalUsd >= 0 ? "Total" : "Net"}
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
            ${Math.abs(position.totalUsd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
}

export default function ProtocolCard({
  name,
  logoUrl,
  url,
  category,
  lastInteractedAt,
  position,
}: ProtocolCardProps) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-3">
        <img
          src={logoUrl}
          alt={name}
          width={32}
          height={32}
          className="w-8 h-8 rounded-lg object-cover shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-sm truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {name}
          </p>
          <span
            className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5"
            style={{
              backgroundColor: "var(--accent-dim)",
              color: "var(--accent)",
            }}
          >
            {category}
          </span>
        </div>
      </div>

      {position !== undefined && <PositionRow position={position} />}

      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Last used {lastInteractedAt > 0 ? timeAgo(lastInteractedAt) : "—"}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "var(--accent-dim)",
            color: "var(--accent)",
          }}
        >
          Open <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
