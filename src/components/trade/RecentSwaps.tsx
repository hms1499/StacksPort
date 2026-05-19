"use client";

import { ExternalLink } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { useWalletStore } from "@/store/walletStore";
import { timeAgo } from "@/lib/utils";

// How many recent swaps to surface on the Trade tab.
const MAX_ROWS = 5;

const DOT_COLOR: Record<string, string> = {
  success: "rgb(34,197,94)",
  error: "rgb(239,68,68)",
  warning: "rgb(234,179,8)",
  info: "var(--text-muted)",
};

export default function RecentSwaps() {
  const notifications = useNotificationStore((s) => s.notifications);
  const network = useWalletStore((s) => s.network);

  const swaps = notifications
    .filter((n) => n.category === "swap")
    .slice(0, MAX_ROWS);

  if (swaps.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        No swaps yet — your recent swaps will appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {swaps.map((n) => {
        const txId = n.context?.txId;
        return (
          <li
            key={n.id}
            className="flex items-center gap-2.5 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: DOT_COLOR[n.type] ?? DOT_COLOR.info }}
            />
            <span className="flex-1 min-w-0 truncate" title={n.message}>
              {n.message}
            </span>
            <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
              {timeAgo(n.timestamp / 1000)}
            </span>
            {txId && (
              <a
                href={`https://explorer.hiro.so/txid/${txId}?chain=${network}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center"
                style={{ color: "var(--accent)" }}
                aria-label="View swap on explorer"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
