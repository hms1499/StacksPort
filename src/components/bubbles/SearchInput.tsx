"use client";

import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
}: SearchInputProps) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2.5 h-7"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <Search size={12} style={{ color: "var(--text-muted)" }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent outline-none text-xs w-24 sm:w-32"
        style={{ color: "var(--text-primary)" }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="hover:opacity-80"
        >
          <X size={12} style={{ color: "var(--text-muted)" }} />
        </button>
      )}
    </div>
  );
}
