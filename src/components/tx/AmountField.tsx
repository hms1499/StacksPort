"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label: string;
  onMax: () => void;
  maxLabel: string;
  balanceLabel: string;
  error?: string | null;
  placeholder?: string;
}

export default function AmountField({
  value, onChange, label, onMax, maxLabel, balanceLabel, error, placeholder = "0.00",
}: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</label>
        <button
          type="button"
          onClick={onMax}
          className="text-xs font-semibold py-1 -my-1 touch-manipulation"
          style={{ color: "var(--accent)" }}
        >
          {maxLabel}
        </button>
      </div>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder={placeholder}
        className="w-full rounded-xl px-3 py-2.5 text-sm bg-transparent border"
        style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
      />
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{balanceLabel}</p>
      {error && <p className="text-[11px]" style={{ color: "var(--negative)" }}>{error}</p>}
    </div>
  );
}
