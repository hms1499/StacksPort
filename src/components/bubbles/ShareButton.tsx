"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Link2 } from "lucide-react";

export default function ShareButton() {
  const t = useTranslations("bubbles.buttons");
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("shareAria")}
      title={t("copyShareLink")}
      className="h-7 px-2 rounded-lg flex items-center gap-1 text-xs hover:opacity-80"
      style={{
        backgroundColor: copied ? "rgba(64,138,113,0.18)" : "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color: copied ? "#5fb594" : "var(--text-muted)",
      }}
    >
      {copied ? <Check size={12} /> : <Link2 size={12} />}
      <span className="hidden sm:inline">{copied ? t("copied") : t("share")}</span>
    </button>
  );
}
