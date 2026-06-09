"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MoreHorizontal,
  RefreshCw,
  Pause,
  Play,
  Camera,
  Link2,
  Keyboard,
  Check,
} from "lucide-react";

interface ToolbarMenuProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  /** Bubble view only: pause + snapshot apply to the animated canvas. */
  bubbleView: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onShowHelp: () => void;
}

const ACCENT = "#5fb594";

function MenuItem({
  icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left hover:bg-white/5 transition-colors"
      style={{ color: active ? ACCENT : "var(--text-secondary)" }}
    >
      <span className="shrink-0 flex items-center justify-center w-4">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && (
        <span
          className="text-[10px] font-mono shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

export default function ToolbarMenu({
  onRefresh,
  isRefreshing,
  bubbleView,
  paused,
  onTogglePause,
  onShowHelp,
}: ToolbarMenuProps) {
  const t = useTranslations("bubbles.toolbar");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSnapshot = () => {
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
      a.download = `bubbles-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, "image/png");
  };

  const handleShare = async () => {
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("more")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("more")}
        className="h-7 w-7 rounded-lg flex items-center justify-center hover:opacity-80"
        style={{
          backgroundColor: open ? "rgba(64,138,113,0.18)" : "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          color: open ? ACCENT : "var(--text-muted)",
        }}
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl py-1 shadow-2xl overflow-hidden"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <MenuItem
            icon={
              <RefreshCw
                size={13}
                className={isRefreshing ? "motion-safe:animate-spin" : ""}
              />
            }
            label={isRefreshing ? t("refreshing") : t("refresh")}
            hint="G"
            onClick={onRefresh}
          />
          {bubbleView && (
            <MenuItem
              icon={paused ? <Play size={13} /> : <Pause size={13} />}
              label={paused ? t("resumeMotion") : t("pauseMotion")}
              hint="P"
              active={paused}
              onClick={onTogglePause}
            />
          )}
          {bubbleView && (
            <MenuItem
              icon={saved ? <Check size={13} /> : <Camera size={13} />}
              label={saved ? t("saved") : t("downloadPng")}
              active={saved}
              onClick={handleSnapshot}
            />
          )}
          <MenuItem
            icon={copied ? <Check size={13} /> : <Link2 size={13} />}
            label={copied ? t("linkCopied") : t("copyLink")}
            active={copied}
            onClick={handleShare}
          />
          <MenuItem
            icon={<Keyboard size={13} />}
            label={t("shortcuts")}
            hint="?"
            onClick={() => {
              setOpen(false);
              onShowHelp();
            }}
          />
        </div>
      )}
    </div>
  );
}
