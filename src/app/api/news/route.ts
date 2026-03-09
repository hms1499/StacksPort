import { NextResponse } from "next/server";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
}

function extractCData(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}(?:[^>]*)>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
    "i"
  );
  return xml.match(re)?.[1]?.trim() ?? "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["']`, "i");
  return xml.match(re)?.[1]?.trim() ?? "";
}

function parseItems(rss: string, sourceName: string): NewsItem[] {
  const itemMatches = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  return itemMatches
    .slice(0, 10)
    .map((m) => {
      const item = m[1];
      const title = extractCData(item, "title");
      const link =
        extractCData(item, "link") || extractAttr(item, "link", "href");
      const pubDate =
        extractCData(item, "pubDate") || extractCData(item, "published");
      const imageUrl =
        extractAttr(item, "enclosure", "url") ||
        extractAttr(item, "media:content", "url") ||
        extractAttr(item, "media:thumbnail", "url") ||
        undefined;

      return { title, url: link, source: sourceName, publishedAt: pubDate, imageUrl };
    })
    .filter((item) => item.title && item.url);
}

export async function GET() {
  try {
    const feeds = [
      { url: "https://cointelegraph.com/rss", source: "CoinTelegraph" },
      {
        url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
        source: "CoinDesk",
      },
    ];

    const results = await Promise.allSettled(
      feeds.map((f) =>
        fetch(f.url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          next: { revalidate: 300 },
        })
          .then((r) => r.text())
          .then((text) => parseItems(text, f.source))
      )
    );

    const items: NewsItem[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") items.push(...result.value);
    }

    items.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    return NextResponse.json(items.slice(0, 8));
  } catch {
    return NextResponse.json([]);
  }
}
