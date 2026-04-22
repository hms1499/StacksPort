"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Newspaper, ChevronDown, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { NewsDigestItem } from "@/lib/ai";

function NewsImage({ src, alt, className = "w-14 h-14" }: { src?: string; alt: string; className?: string }) {
  if (!src) {
    return (
      <div
        className={`${className} rounded-xl shrink-0 flex items-center justify-center`}
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <Newspaper size={18} style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }
  return (
    <div className={`${className} rounded-xl shrink-0 overflow-hidden relative`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        unoptimized
        onError={(e) => {
          const parent = (e.currentTarget as HTMLImageElement).parentElement;
          if (parent)
            parent.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-elevated)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg></div>`;
        }}
      />
    </div>
  );
}

function NewsItem({ item }: { item: NewsDigestItem }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);

    if (next && content === null && !loading) {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/news/article?url=${encodeURIComponent(item.url)}`);
        const data = await res.json();
        if (res.ok && data.content) {
          setContent(data.content);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: "var(--bg-elevated)" }}
    >
      {/* Summary row */}
      <button
        onClick={handleToggle}
        className="w-full flex items-start gap-3 p-3 text-left"
      >
        <NewsImage src={item.imageUrl} alt={item.headline} />

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium mb-1 line-clamp-2"
            style={{ color: "var(--text-primary)" }}
          >
            {item.headline}
          </p>
          <span
            className="text-[10px] font-medium uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            {item.source}
          </span>
        </div>

        <ChevronDown
          size={15}
          className="shrink-0 mt-1 transition-transform duration-200"
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-3 pb-4 pt-2"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              {/* Large image */}
              {item.imageUrl && (
                <div className="relative w-full h-40 rounded-xl overflow-hidden mb-3">
                  <Image
                    src={item.imageUrl}
                    alt={item.headline}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}

              {/* Article content */}
              {loading && (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 size={15} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading article…</span>
                </div>
              )}

              {error && (
                <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>
                  Could not load article content.
                </p>
              )}

              {content && (
                <div className="space-y-2 mb-3">
                  {content.split("\n\n").map((para, i) => (
                    <p key={i} className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {para}
                    </p>
                  ))}
                </div>
              )}

              {/* Read more */}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: "var(--accent)" }}
              >
                Read full article
                <ExternalLink size={12} />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NewsDigestCard({
  summary,
  items,
}: {
  summary: string;
  items: NewsDigestItem[];
}) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        News Digest
      </h3>

      <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {summary}
      </p>

      <div className="space-y-2">
        {items.map((item, i) => (
          <NewsItem key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
