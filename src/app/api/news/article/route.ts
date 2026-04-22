import { NextResponse } from "next/server";

const cache = new Map<string, { content: string; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

function extractContent(html: string): string {
  // Remove scripts, styles, nav, header, footer, ads
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Try to isolate article body
  const articleMatch =
    stripped.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    stripped.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    stripped;

  // Extract paragraph text
  const paragraphs = [...articleMatch.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, "")           // strip inner tags
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((p) => p.length > 60);        // skip short/boilerplate lines

  return paragraphs.slice(0, 6).join("\n\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ content: cached.content });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch article" }, { status: 502 });
    }

    const html = await res.text();
    const content = extractContent(html);

    if (!content) {
      return NextResponse.json({ error: "Could not extract content" }, { status: 422 });
    }

    cache.set(url, { content, ts: Date.now() });
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: "Fetch timeout or error" }, { status: 502 });
  }
}
