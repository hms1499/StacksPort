"use client";

import { ExternalLink } from "lucide-react";
import type { NewsDigestItem } from "@/lib/ai";

export default function NewsDigestCard({
  summary,
  items,
}: {
  summary: string;
  items: NewsDigestItem[];
}) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>News Digest</h3>

      <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {summary}
      </p>

      <div className="space-y-3">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 rounded-xl transition-colors group"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1 line-clamp-2 transition-colors" style={{ color: 'var(--text-primary)' }}>
                  {item.headline}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {item.insight}
                </p>
                <span className="text-[10px] font-medium mt-1 inline-block uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  {item.source}
                </span>
              </div>
              <ExternalLink
                size={14}
                className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
              />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
