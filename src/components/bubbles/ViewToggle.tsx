"use client";

import { Circle, List } from "lucide-react";

export type View = "bubbles" | "list";

interface ViewToggleProps {
  value: View;
  onChange: (v: View) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  const opts: Array<{ k: View; icon: typeof Circle; label: string }> = [
    { k: "bubbles", icon: Circle, label: "Bubble view" },
    { k: "list", icon: List, label: "List view" },
  ];
  return (
    <div
      className="h-7 flex items-center rounded-lg overflow-hidden"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {opts.map((o) => {
        const active = o.k === value;
        const Icon = o.icon;
        return (
          <button
            key={o.k}
            type="button"
            onClick={() => onChange(o.k)}
            aria-label={o.label}
            aria-pressed={active}
            title={o.label}
            className="h-7 w-7 flex items-center justify-center"
            style={{
              backgroundColor: active ? "var(--accent)" : "transparent",
              color: active ? "#000" : "var(--text-muted)",
            }}
          >
            <Icon size={12} />
          </button>
        );
      })}
    </div>
  );
}
