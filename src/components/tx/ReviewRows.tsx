"use client";

interface Props {
  title: string;
  rows: Array<[string, string]>;
}

export default function ReviewRows({ title, rows }: Props) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1.5"
      style={{ backgroundColor: "var(--bg-elevated)" }}
    >
      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      {rows.map(([label, val]) => (
        <div key={label} className="flex items-center justify-between text-xs">
          <span style={{ color: "var(--text-muted)" }}>{label}</span>
          <span className="font-semibold font-data" style={{ color: "var(--text-primary)" }}>{val}</span>
        </div>
      ))}
    </div>
  );
}
