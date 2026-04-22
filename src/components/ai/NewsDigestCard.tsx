"use client";

import Image from "next/image";
import { ExternalLink, Newspaper } from "lucide-react";
import type { NewsDigestItem } from "@/lib/ai";

function NewsImage({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return (
      <div
        className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <Newspaper size={20} style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }
  return (
    <div className="w-16 h-16 rounded-xl shrink-0 overflow-hidden relative">
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

      <div className="space-y-3">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 rounded-xl transition-colors group"
            style={{ backgroundColor: "var(--bg-elevated)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-elevated)")}
          >
            <NewsImage src={item.imageUrl} alt={item.headline} />

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <p
                  className="text-sm font-medium mb-1 line-clamp-2 flex-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.headline}
                </p>
                <ExternalLink
                  size={14}
                  className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--text-muted)" }}
                />
              </div>
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
          </a>
        ))}
      </div>
    </div>
  );
}
