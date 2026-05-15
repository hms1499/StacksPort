"use client";

import { Pause, Play } from "lucide-react";

interface PauseButtonProps {
  paused: boolean;
  onToggle: () => void;
}

export default function PauseButton({ paused, onToggle }: PauseButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={paused ? "Resume animation" : "Pause animation"}
      aria-pressed={paused}
      title={paused ? "Resume (P)" : "Pause (P)"}
      className="h-7 w-7 rounded-lg flex items-center justify-center hover:opacity-80"
      style={{
        backgroundColor: paused ? "rgba(64,138,113,0.18)" : "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color: paused ? "#5fb594" : "var(--text-muted)",
      }}
    >
      {paused ? <Play size={12} /> : <Pause size={12} />}
    </button>
  );
}
