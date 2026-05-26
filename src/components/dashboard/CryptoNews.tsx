"use client";

import { Newspaper, ExternalLink, Clock } from "lucide-react";
import { useNews, type NewsItem } from "@/hooks/useMarketData";

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isNaN(diff) || diff < 0) return "—";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SOURCE_COLORS: Record<string, string> = {
  CoinTelegraph: "bg-orange-50 text-orange-500",
  CoinDesk: "bg-blue-50 text-blue-500",
};

function NewsRow({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 py-3 px-2 -mx-2 rounded-xl transition-colors group"
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {/* Thumbnail or fallback */}
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Newspaper size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium line-clamp-2 leading-snug" style={{ color: 'var(--text-primary)' }}>
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${SOURCE_COLORS[item.source] ?? ""}`}
            style={SOURCE_COLORS[item.source] ? undefined : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            {item.source}
          </span>
          <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Clock size={9} />
            {timeAgo(item.publishedAt)}
          </span>
        </div>
      </div>

      <ExternalLink
        size={12}
        className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1"
      />
    </a>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 py-3 px-2">
      <div className="w-12 h-12 rounded-xl shrink-0 skeleton" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 rounded w-full skeleton" />
        <div className="h-3 rounded w-3/4 skeleton" />
        <div className="flex gap-2 mt-1">
          <div className="h-3 rounded w-16 skeleton" />
          <div className="h-3 rounded w-10 skeleton" />
        </div>
      </div>
    </div>
  );
}

export default function CryptoNews() {
  const { data: news, isLoading } = useNews();

  return (
    <div
      className="glass-card rounded-2xl p-5 shadow-sm h-full flex flex-col overflow-hidden"
      style={{ ['--card-accent' as string]: '#60A5FA' }}
    >
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Crypto News</h2>
          <span className="text-[10px] font-semibold bg-red-50 text-red-500 px-1.5 py-0.5 rounded-md">
            24h
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>CoinTelegraph · CoinDesk</span>
      </div>

      <div className="divide-y flex-1 min-h-0 overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }}>
        {isLoading
          ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
          : !news || news.length === 0
          ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Newspaper size={32} className="mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No news available</p>
            </div>
          )
          : news.map((item) => <NewsRow key={item.url} item={item} />)}
      </div>
    </div>
  );
}
