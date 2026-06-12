// src/app/api/ai/chat/route.ts
import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { Stream } from "groq-sdk/core/streaming";
import type { ChatCompletionChunk } from "groq-sdk/resources/chat/completions";
import { getMarketSnapshot } from "@/lib/server/market-snapshot";
import { getPortfolioSnapshot } from "@/lib/server/portfolio-snapshot";
import { buildChatContext } from "@/lib/server/chat-context";
import { buildMessages, validateChatRequest } from "@/lib/server/chat-prompt";
import { isChatRateLimited } from "@/lib/server/chat-rate-limit";
import { GROQ_MODEL, GROQ_FALLBACK_MODEL, GROQ_TIMEOUT_MS } from "@/lib/server/groq-client";

const MAX_RESPONSE_TOKENS = 700;

export async function POST(request: Request) {
  // 1. Validate the body.
  let parsed: { messages: { role: "user" | "assistant"; content: string }[]; address?: string };
  try {
    parsed = validateChatRequest(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  // 2. Rate limit per IP (+ address when present).
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rlKey = parsed.address ? `${ip}:${parsed.address}` : ip;
  if (await isChatRateLimited(rlKey)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  // 3. Require a key.
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
  }

  // 4. Grounding snapshots (portfolio only when a wallet is connected).
  const [market, portfolio] = await Promise.all([
    getMarketSnapshot(),
    parsed.address ? getPortfolioSnapshot(parsed.address) : Promise.resolve(null),
  ]);

  const messages = buildMessages(buildChatContext(market, portfolio), parsed.messages);
  const groq = new Groq({ apiKey });

  // 5. Open the stream, falling back to the cheaper model on an initial throw.
  async function open(model: string): Promise<Stream<ChatCompletionChunk>> {
    return groq.chat.completions.create(
      { model, messages, temperature: 0.4, max_tokens: MAX_RESPONSE_TOKENS, stream: true },
      { timeout: GROQ_TIMEOUT_MS, maxRetries: 0 }
    );
  }

  let completion: Stream<ChatCompletionChunk>;
  try {
    completion = await open(GROQ_MODEL);
  } catch (err) {
    console.warn("[AI Chat] primary model failed, falling back:", err);
    try {
      completion = await open(GROQ_FALLBACK_MODEL);
    } catch (err2) {
      console.error("[AI Chat] both models failed:", err2);
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }
  }

  // 6. Pipe deltas out as plain UTF-8 text.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        console.error("[AI Chat] stream error:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
