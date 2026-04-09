import { NextResponse } from "next/server";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

async function sendTelegramMessage(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
}

interface NewsArticle {
  title: string;
  source: string;
  url: string;
  published_at?: string;
}

async function fetchCryptoNews(query?: string): Promise<NewsArticle[]> {
  const params = new URLSearchParams({ limit: "5" });
  if (query) params.set("q", query);
  const res = await fetch(
    `https://cryptocurrency.cv/api/news?${params.toString()}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.articles ?? data.results ?? [];
}

function formatNews(articles: NewsArticle[], heading: string): string {
  if (articles.length === 0) return `${heading}\n\nNo news found.`;
  const lines = articles.map(
    (a, i) => `${i + 1}. [${a.title}](${a.url})\n    _${a.source}_`
  );
  return `${heading}\n\n${lines.join("\n\n")}`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const message = body?.message;

  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  if (chatId !== ALLOWED_CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

  if (text === "/news" || text === "/run") {
    const articles = await fetchCryptoNews();
    const msg = formatNews(articles, "*Crypto News Today*");
    await sendTelegramMessage(chatId, msg);
  } else if (text.startsWith("/news ")) {
    const query = text.slice(6).trim();
    const articles = await fetchCryptoNews(query);
    const msg = formatNews(articles, `*News: ${query}*`);
    await sendTelegramMessage(chatId, msg);
  } else if (text === "/stacks") {
    const articles = await fetchCryptoNews("stacks STX");
    const msg = formatNews(articles, "*Stacks Ecosystem News*");
    await sendTelegramMessage(chatId, msg);
  } else if (text === "/btc") {
    const articles = await fetchCryptoNews("bitcoin");
    const msg = formatNews(articles, "*Bitcoin News*");
    await sendTelegramMessage(chatId, msg);
  } else if (text === "/downloads") {
    const res = await fetch(
      "https://api.npmjs.org/downloads/point/last-day/@stacksport/dca-sdk"
    );
    const data = await res.json();
    await sendTelegramMessage(
      chatId,
      `*@stacksport/dca-sdk*\nDownloads today: *${data.downloads}*`
    );
  } else if (text === "/help") {
    await sendTelegramMessage(
      chatId,
      "*Available Commands:*\n\n" +
        "/news — Top crypto news today\n" +
        "/news _keyword_ — Search news by topic\n" +
        "/stacks — Stacks ecosystem news\n" +
        "/btc — Bitcoin news\n" +
        "/downloads — SDK download stats\n" +
        "/help — Show this message"
    );
  }

  return NextResponse.json({ ok: true });
}
