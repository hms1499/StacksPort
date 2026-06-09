"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Trash2, Upload } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";

export default function WatchlistBar() {
  const t = useTranslations("bubbles.watchlistBar");
  const { ids, size, clear, replace } = useWatchlist();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<string | null>(null);

  const onExport = () => {
    const payload = {
      v: 1,
      exportedAt: new Date().toISOString(),
      ids: [...ids],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bubbles-watchlist-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onImportClick = () => fileInputRef.current?.click();

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const arr: unknown = Array.isArray(parsed) ? parsed : parsed?.ids;
      if (!Array.isArray(arr)) {
        setImported(t("invalidFile"));
      } else {
        const clean = arr.filter((v): v is string => typeof v === "string");
        replace(clean);
        setImported(t("imported", { n: clean.length }));
      }
    } catch {
      setImported(t("invalidJson"));
    }
    setTimeout(() => setImported(null), 2000);
  };

  const onClear = () => {
    if (size === 0) return;
    if (window.confirm(t("confirmClear", { n: size }))) {
      clear();
    }
  };

  return (
    <div
      className="px-4 py-1.5 flex items-center gap-2 text-[11px] flex-wrap"
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        color: "var(--text-muted)",
      }}
    >
      <span>
        {t("label")}{" "}
        <span style={{ color: "var(--text-primary)" }}>
          {t("tokenCount", { n: size })}
        </span>
      </span>
      <span className="opacity-40">·</span>
      <button
        type="button"
        onClick={onExport}
        disabled={size === 0}
        className="flex items-center gap-1 hover:opacity-80 disabled:opacity-40"
      >
        <Download size={11} /> {t("export")}
      </button>
      <span className="opacity-40">·</span>
      <button
        type="button"
        onClick={onImportClick}
        className="flex items-center gap-1 hover:opacity-80"
      >
        <Upload size={11} /> {t("import")}
      </button>
      <span className="opacity-40">·</span>
      <button
        type="button"
        onClick={onClear}
        disabled={size === 0}
        className="flex items-center gap-1 hover:opacity-80 disabled:opacity-40"
        style={{ color: size === 0 ? undefined : "#f87171" }}
      >
        <Trash2 size={11} /> {t("clearAll")}
      </button>
      {imported && (
        <span className="ml-auto" style={{ color: "#5fb594" }}>
          {imported}
        </span>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFile}
      />
    </div>
  );
}
