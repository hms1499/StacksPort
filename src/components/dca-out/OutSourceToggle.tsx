"use client";

import { useTranslations } from "next-intl";
import { Bitcoin, Coins } from "lucide-react";

export type OutSource = "sbtc" | "stx";

const OPTIONS: Array<{ key: OutSource; labelKey: string; icon: typeof Bitcoin }> = [
  { key: "sbtc", labelKey: "outSourceSbtc", icon: Bitcoin },
  { key: "stx",  labelKey: "outSourceStx",  icon: Coins  },
];

interface Props {
  value: OutSource;
  onChange: (v: OutSource) => void;
}

export default function OutSourceToggle({ value, onChange }: Props) {
  const t = useTranslations("dca");
  return (
    <div
      className="inline-flex gap-1 p-1 rounded-2xl self-start"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
      role="tablist"
      aria-label="DCA out source"
    >
      {OPTIONS.map(({ key, labelKey, icon: Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={
              active
                ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "var(--shadow-card)" }
                : { color: "var(--text-muted)", opacity: 0.8 }
            }
          >
            <Icon size={14} />
            <span>{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
