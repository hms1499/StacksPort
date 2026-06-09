"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange, placeholder }, ref) {
    const t = useTranslations("bubbles");
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
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? t("searchShort")}
          className="bg-transparent outline-none text-xs w-24 sm:w-32"
          style={{ color: "var(--text-primary)" }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("clearSearch")}
            className="hover:opacity-80"
          >
            <X size={12} style={{ color: "var(--text-muted)" }} />
          </button>
        )}
      </div>
    );
  }
);

export default SearchInput;
