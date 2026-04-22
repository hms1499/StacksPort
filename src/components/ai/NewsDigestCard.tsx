"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Newspaper, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { NewsDigestItem } from "@/lib/ai";

function NewsImage({ src, alt, className = "w-16 h-16" }: { src?: string; alt: string; className?: string }) {
  if (!src) {
    return (
      <div
        className={`${className} rounded-xl shrink-0 flex items-center justify-center`}
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <Newspaper size={20} style={{ color: "var(--text-muted)" }} />
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
          if (parent) parent.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-elevated)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M2 15h10"/><path d="M9 18l3-3-3-3"/></svg></div>`;
        }}
      />
    </div>
  );
}

function NewsModal({ item, onClose }: { item: NewsDigestItem; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image */}
          {item.imageUrl && (
            <div className="relative w-full h-48">
              <Image
                src={item.imageUrl}
                alt={item.headline}
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, var(--bg-card))" }} />
            </div>
          )}

          <div className="p-5">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: "rgba(0,0,0,0.4)", color: "#fff" }}
            >
              <X size={16} />
            </button>

            {/* Source badge */}
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-3 inline-block"
              style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-muted)" }}
            >
              {item.source}
            </span>

            {/* Headline */}
            <h3 className="text-base font-bold mb-3 leading-snug" style={{ color: "var(--text-primary)" }}>
              {item.headline}
            </h3>

            {/* Insight */}
            <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-secondary)" }}>
              {item.insight}
            </p>

            {/* Read more */}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              style={{ backgroundColor: "var(--accent)", color: "#060C18" }}
            >
              Read full article
              <ExternalLink size={14} />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function NewsDigestCard({
  summary,
  items,
}: {
  summary: string;
  items: NewsDigestItem[];
}) {
  const [selected, setSelected] = useState<NewsDigestItem | null>(null);

  const handleClick = (item: NewsDigestItem) => {
    setSelected((prev) => (prev === item ? null : item));
  };

  return (
    <>
      <div className="glass-card rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          News Digest
        </h3>

        <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {summary}
        </p>

        <div className="space-y-3">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => handleClick(item)}
              className="w-full flex items-start gap-3 p-3 rounded-xl transition-colors group text-left"
              style={{ backgroundColor: "var(--bg-elevated)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-elevated)")}
            >
              <NewsImage src={item.imageUrl} alt={item.headline} />

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium mb-1 line-clamp-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.headline}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {item.insight}
                </p>
                <span
                  className="text-[10px] font-medium mt-1 inline-block uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  {item.source}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && <NewsModal item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
