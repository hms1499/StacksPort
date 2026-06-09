"use client";

import { useTranslations } from "next-intl";
import { Pause, Play } from "lucide-react";

interface PauseButtonProps {
  paused: boolean;
  onToggle: () => void;
}

export default function PauseButton({ paused, onToggle }: PauseButtonProps) {
  const t = useTranslations("bubbles.buttons");
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={paused ? t("resumeAnim") : t("pauseAnim")}
      aria-pressed={paused}
      title={paused ? t("resumeP") : t("pauseP")}
      className="relative h-7 w-7 rounded-lg flex items-center justify-center hover:opacity-80"
      style={{
        backgroundColor: paused ? "rgba(64,138,113,0.18)" : "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color: paused ? "#5fb594" : "var(--text-muted)",
      }}
    >
      {paused ? <Play size={12} /> : <Pause size={12} />}
      {paused && (
        <span
          className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full motion-safe:animate-pulse"
          style={{ backgroundColor: "#5fb594" }}
          aria-hidden
        />
      )}
    </button>
  );
}
