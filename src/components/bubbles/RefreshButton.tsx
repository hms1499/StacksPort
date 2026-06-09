"use client";

import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  onClick: () => void;
  isRefreshing: boolean;
}

export default function RefreshButton({ onClick, isRefreshing }: RefreshButtonProps) {
  const t = useTranslations("bubbles.buttons");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("refreshAria")}
      title={t("refreshTitle")}
      disabled={isRefreshing}
      className="h-7 w-7 rounded-lg flex items-center justify-center hover:opacity-80 disabled:opacity-50"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-muted)",
      }}
    >
      <RefreshCw
        size={12}
        className={isRefreshing ? "motion-safe:animate-spin" : ""}
      />
    </button>
  );
}
