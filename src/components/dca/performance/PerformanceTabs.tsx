"use client";

type Tab = "in" | "out";

export default function PerformanceTabs({
  active, onChange,
}: { active: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: "in", label: "DCA In" },
    { id: "out", label: "DCA Out" },
  ];
  return (
    <div
      className="flex items-center gap-1 border-b"
      style={{ borderColor: "var(--border-subtle)" }}
      role="tablist"
      aria-label="DCA performance view"
    >
      {items.map((it) => {
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(it.id)}
            className="px-4 py-2 text-sm font-semibold transition-colors relative"
            style={{
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {it.label}
            {isActive && (
              <span
                className="absolute left-0 right-0 -bottom-px h-0.5"
                style={{ backgroundColor: "var(--accent)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
