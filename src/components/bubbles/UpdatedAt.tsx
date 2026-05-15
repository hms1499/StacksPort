"use client";

import { useEffect, useState } from "react";

interface UpdatedAtProps {
  timestamp: number | null;
}

function format(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function UpdatedAt({ timestamp }: UpdatedAtProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  if (!timestamp) return null;

  return (
    <span
      className="text-[10px] font-mono hidden sm:inline"
      style={{ color: "var(--text-muted)" }}
      title={new Date(timestamp).toLocaleString()}
    >
      Updated {format(timestamp, now)}
    </span>
  );
}
