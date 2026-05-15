"use client";

import { Camera, Check } from "lucide-react";
import { useState } from "react";

interface SnapshotButtonProps {
  filenamePrefix?: string;
}

export default function SnapshotButton({
  filenamePrefix = "bubbles",
}: SnapshotButtonProps) {
  const [saved, setSaved] = useState(false);

  const onClick = () => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[data-bubble-canvas="true"]'
    );
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `${filenamePrefix}-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, "image/png");
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Download snapshot as PNG"
      title="Download PNG"
      className="h-7 w-7 rounded-lg flex items-center justify-center hover:opacity-80"
      style={{
        backgroundColor: saved ? "rgba(64,138,113,0.18)" : "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color: saved ? "#5fb594" : "var(--text-muted)",
      }}
    >
      {saved ? <Check size={12} /> : <Camera size={12} />}
    </button>
  );
}
