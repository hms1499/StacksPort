"use client";

import { ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface ProtocolCardProps {
  name: string;
  logoUrl: string;
  url: string;
  category: string;
  lastInteractedAt: number;
}

export default function ProtocolCard({
  name,
  logoUrl,
  url,
  category,
  lastInteractedAt,
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
