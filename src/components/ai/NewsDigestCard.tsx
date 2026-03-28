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
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">News Digest</h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
        {summary}
      </p>

      <div className="space-y-3">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 line-clamp-2 group-hover:text-[#285A48] dark:group-hover:text-[#B0E4CC] transition-colors">
                  {item.headline}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {item.insight}
                </p>
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-1 inline-block uppercase tracking-wide">
                  {item.source}
                </span>
              </div>
              <ExternalLink
                size={14}
                className="text-gray-400 dark:text-gray-500 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
