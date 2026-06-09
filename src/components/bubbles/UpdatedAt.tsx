"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface UpdatedAtProps {
  timestamp: number | null;
}

function format(
  ts: number,
  now: number,
  t: (key: string, values?: Record<string, number>) => string
): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 5) return t("time.justNow");
  if (s < 60) return t("time.secondsAgo", { n: s });
  const m = Math.floor(s / 60);
  if (m < 60) return t("time.minutesAgo", { n: m });
  const h = Math.floor(m / 60);
  return t("time.hoursAgo", { n: h });
}

export default function UpdatedAt({ timestamp }: UpdatedAtProps) {
  const t = useTranslations("bubbles");
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
      {t("updated", { time: format(timestamp, now, t) })}
    </span>
  );
}
