# Ask Stacks AI — Conversational Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only, streaming conversational assistant to the `/ai` tab that answers questions grounded in the live market snapshot plus (when a wallet is connected) the user's portfolio snapshot.

**Architecture:** A thin streaming route (`POST /api/ai/chat`) assembles a compact factual context block from the two existing server snapshots, injects it as the system prompt, and streams Groq's reply back as plain UTF-8 text. All logic that can be pure (context building, prompt assembly, request validation, history trimming) lives in pure, unit-tested modules; the route and the React layer are thin wiring. The client holds conversation history in ephemeral component state and resends it each turn — no persistence, no tool-calling.

**Tech Stack:** Next.js 15 App Router (route handler returning a `ReadableStream`), `groq-sdk` streaming, Upstash Redis (rate limit, reusing the existing pattern), Zustand-free local hook state, SWR not needed here, next-intl for i18n, Vitest for unit tests.

---

## File Structure

- **Create** `src/lib/ai-chat.ts` — client-safe shared types (`ChatMessage`, request/response shapes) + `fetchChatStream` browser helper. One responsibility: the chat wire contract.
- **Create** `src/lib/server/chat-context.ts` — pure `buildChatContext(market, portfolio)` → factual text block. One responsibility: snapshot → grounding text.
- **Create** `src/lib/server/chat-context.test.ts` — unit tests for the builder.
- **Create** `src/lib/server/chat-prompt.ts` — pure `SYSTEM_PROMPT`, `buildMessages`, `trimHistory`, `validateChatRequest`. One responsibility: turn a validated request + context into the Groq `messages` array.
- **Create** `src/lib/server/chat-prompt.test.ts` — unit tests for prompt assembly / validation / trimming.
- **Create** `src/lib/server/chat-rate-limit.ts` — `isChatRateLimited(key)` reusing the Redis sliding-window pattern. One responsibility: per-IP+address cost guard.
- **Create** `src/app/api/ai/chat/route.ts` — streaming route handler (wiring only).
- **Create** `src/hooks/useAIChat.ts` — ephemeral conversation state + streaming fetch.
- **Create** `src/components/ai/AskStacksAICard.tsx` — chat UI section.
- **Modify** `src/components/ai/AIPageContent.tsx` — render the card full-width at the bottom of the grid.
- **Modify** `messages/en.json` + `messages/vi.json` — add the `ai.chat` namespace.

---

## Task 1: Shared chat wire types + client stream helper

**Files:**
- Create: `src/lib/ai-chat.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/lib/ai-chat.ts
// Client-safe chat wire contract. Shared by the streaming route, the React hook,
// and the UI. Kept dependency-free so it can be imported on either side.

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  address?: string;
}

/**
 * POST the conversation and yield assistant text deltas as they stream in.
 * The route responds with a plain UTF-8 text stream (not SSE). Throws on a
 * non-OK response so the caller can surface the right error; `signal` lets the
 * caller abort an in-flight stream.
 */
export async function* fetchChatStream(
  body: ChatRequest,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`chat request failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) yield decoder.decode(value, { stream: true });
  }
}
```

- [ ] **Step 2: Typecheck the new file compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i ai-chat || echo "no ai-chat errors"`
Expected: `no ai-chat errors`

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai-chat.ts
git commit -m "feat(ai-chat): add shared chat wire types + fetchChatStream helper"
```

---

## Task 2: Pure grounding-context builder + tests

**Files:**
- Create: `src/lib/server/chat-context.ts`
- Test: `src/lib/server/chat-context.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/server/chat-context.test.ts
import { describe, it, expect } from "vitest";
import { buildChatContext } from "./chat-context";
import type { MarketSnapshot } from "./market-snapshot";
import type { PortfolioSnapshot } from "./portfolio-snapshot";

const market: MarketSnapshot = {
  generatedAt: 0,
  trending: [
    { id: "x", symbol: "ALEX", name: "Alex", priceUsd: 0.1, change24h: 5, image: "", sparkline: [] },
    { id: "y", symbol: "WELSH", name: "Welsh", priceUsd: 0.001, change24h: -3, image: "", sparkline: [] },
  ],
  stxStats: { price: 1.85, change24h: 4.2, marketCap: 2_800_000_000, volume24h: 90_000_000 },
  stxHistory7d: { prices: [1.7, 1.85], marketCaps: [], volumes: [] },
  pox: null,
  fearGreed: { value: 31, classification: "Fear" },
  news: [],
  swapPrices: { bitcoin: { usd: 95000 } },
};

const portfolio: PortfolioSnapshot = {
  generatedAt: 0,
  address: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR",
  portfolio: {
    totalUSD: 1234.5, stxUSD: 1000, otherUSD: 234.5, stackingUSD: 0,
    stxBalance: 0, stxHumanBalance: 540, stxPrice: 1.85, stxChange24h: 4.2,
    geckoTokens: [], fixedTokens: [], fixedValueUSD: 0,
  },
  fungibleTokens: null,
  tokensWithValues: null,
  transactions: null,
  dcaPlans: [
    { id: 7, owner: "SP", token: "SP.token-sbtc", amt: 5_000_000, ivl: 4550, leb: 0, bal: 25_000_000, tsd: 3, tss: 15_000_000, active: true, cat: 0 },
  ],
  pnl: {
    entries: [
      { contractId: "c", symbol: "ALEX", name: "Alex", imageUri: undefined, currentBalance: 100, currentPrice: 0.1, currentValue: 10, avgCostBasis: 0.05, totalCost: 5, unrealizedPnL: 5, unrealizedPct: 100, realizedPnL: 0, totalPnL: 5 },
    ],
    totalUnrealized: 5, totalRealized: 0, totalPnL: 5,
  },
  stackingStatus: null,
  sbtcData: null,
};

describe("buildChatContext", () => {
  it("includes market facts with real numbers", () => {
    const out = buildChatContext(market, null);
    expect(out).toContain("1.85");        // STX price
    expect(out).toContain("31");          // fear & greed value
    expect(out).toContain("Fear");        // classification
    expect(out).toContain("95000");       // BTC price
    expect(out).toContain("ALEX");        // trending symbol
  });

  it("notes portfolio is unavailable when no wallet is connected", () => {
    const out = buildChatContext(market, null);
    expect(out.toLowerCase()).toContain("no wallet");
  });

  it("includes portfolio facts when a wallet is connected", () => {
    const out = buildChatContext(market, portfolio);
    expect(out).toContain("1234.5");      // total USD
    expect(out).toContain("#7");          // DCA plan id
    expect(out).toContain("Weekly");      // ivl 4550 -> Weekly
    expect(out).toContain("ALEX");        // pnl entry symbol
  });

  it("degrades missing fields to N/A without throwing", () => {
    const bare: MarketSnapshot = { ...market, stxStats: null, fearGreed: null, trending: null, swapPrices: {} };
    expect(() => buildChatContext(bare, null)).not.toThrow();
    expect(buildChatContext(bare, null)).toContain("N/A");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/chat-context.test.ts`
Expected: FAIL — `buildChatContext` is not exported / module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/server/chat-context.ts
// Pure: turns the live market snapshot (+ optional portfolio snapshot) into a
// compact, factual plain-text block injected as the chat system prompt. Every
// number here comes from real snapshot data — the model is told to use only
// these figures, mirroring the anti-hallucination posture of the insights and
// personal-alerts paths. Defensive on null/missing fields: degrades to "N/A",
// never throws.
import type { MarketSnapshot } from "./market-snapshot";
import type { PortfolioSnapshot } from "./portfolio-snapshot";
import { microToSTX, blocksToInterval } from "@/lib/dca";

function num(n: number | null | undefined, digits = 2): string {
  return n === null || n === undefined || Number.isNaN(n) ? "N/A" : n.toFixed(digits);
}

function marketSection(m: MarketSnapshot): string {
  const s = m.stxStats;
  const fg = m.fearGreed;
  const btc = m.swapPrices?.bitcoin?.usd ?? null;
  const trending = (m.trending ?? []).slice(0, 5).map((t) => t.symbol).join(", ") || "N/A";
  const sevenD =
    m.stxHistory7d && m.stxHistory7d.prices.length >= 2
      ? `${(((m.stxHistory7d.prices[m.stxHistory7d.prices.length - 1] - m.stxHistory7d.prices[0]) / m.stxHistory7d.prices[0]) * 100).toFixed(2)}%`
      : "N/A";
  return [
    "## Market (live)",
    `- STX price: $${num(s?.price, 4)} (24h ${num(s?.change24h)}%, 7d ${sevenD})`,
    `- STX market cap: $${s ? (s.marketCap / 1e6).toFixed(1) + "M" : "N/A"}, 24h volume: $${s ? (s.volume24h / 1e6).toFixed(1) + "M" : "N/A"}`,
    `- BTC price: $${num(btc, 0)}`,
    `- Fear & Greed: ${fg ? `${fg.value} (${fg.classification})` : "N/A"}`,
    `- Trending tokens: ${trending}`,
  ].join("\n");
}

function portfolioSection(p: PortfolioSnapshot): string {
  const lines: string[] = ["## Your portfolio (connected wallet)"];
  const v = p.portfolio;
  if (v) {
    lines.push(`- Total value: $${num(v.totalUSD)} (STX $${num(v.stxUSD)}, other $${num(v.otherUSD)})`);
    lines.push(`- STX balance: ${num(v.stxHumanBalance, 4)} STX`);
  }
  const plans = (p.dcaPlans ?? []).filter((d) => d.active);
  if (plans.length > 0) {
    lines.push("- Active DCA plans:");
    for (const d of plans) {
      const target = d.token.split(".")[1] ?? d.token;
      lines.push(
        `  - #${d.id}: ${num(microToSTX(d.amt), 2)} STX -> ${target} every ${blocksToInterval(d.ivl)}; balance ${num(microToSTX(d.bal), 2)} STX; ${d.tsd} swaps done`
      );
    }
  } else {
    lines.push("- Active DCA plans: none");
  }
  const entries = p.pnl?.entries ?? [];
  if (entries.length > 0) {
    lines.push("- Holdings PnL:");
    for (const e of entries.slice(0, 6)) {
      lines.push(
        `  - ${e.symbol}: value $${num(e.currentValue)}, unrealized ${e.unrealizedPnL >= 0 ? "+" : ""}$${num(e.unrealizedPnL)} (${num(e.unrealizedPct)}%)`
      );
    }
  }
  return lines.join("\n");
}

export function buildChatContext(
  market: MarketSnapshot,
  portfolio: PortfolioSnapshot | null
): string {
  const parts = [marketSection(market)];
  if (portfolio) {
    parts.push(portfolioSection(portfolio));
  } else {
    parts.push("## Your portfolio\n- No wallet connected. Portfolio-specific data is unavailable until the user connects a wallet.");
  }
  return parts.join("\n\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/chat-context.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/chat-context.ts src/lib/server/chat-context.test.ts
git commit -m "feat(ai-chat): pure grounding-context builder from market+portfolio snapshots"
```

---

## Task 3: Pure prompt assembly, history trim, request validation + tests

**Files:**
- Create: `src/lib/server/chat-prompt.ts`
- Test: `src/lib/server/chat-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/server/chat-prompt.test.ts
import { describe, it, expect } from "vitest";
import { trimHistory, validateChatRequest, buildMessages, SYSTEM_PROMPT } from "./chat-prompt";

describe("trimHistory", () => {
  it("keeps only the most recent N messages", () => {
    const msgs = Array.from({ length: 14 }, (_, i) => ({ role: "user" as const, content: `m${i}` }));
    const out = trimHistory(msgs, 10);
    expect(out).toHaveLength(10);
    expect(out[0].content).toBe("m4");
    expect(out[9].content).toBe("m13");
  });

  it("drops malformed entries", () => {
    const out = trimHistory(
      [
        { role: "user", content: "ok" },
        { role: "system" as unknown as "user", content: "bad role" },
        { role: "assistant", content: "" },
        { role: "assistant", content: "fine" },
      ] as never,
      10
    );
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.content)).toEqual(["ok", "fine"]);
  });
});

describe("validateChatRequest", () => {
  it("accepts a valid body and trims the address", () => {
    const out = validateChatRequest({
      messages: [{ role: "user", content: "hi" }],
      address: "  SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR  ",
    });
    expect(out.messages).toHaveLength(1);
    expect(out.address).toBe("SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR");
  });

  it("accepts a body with no address (no wallet)", () => {
    const out = validateChatRequest({ messages: [{ role: "user", content: "hi" }] });
    expect(out.address).toBeUndefined();
  });

  it("throws when there are no usable messages", () => {
    expect(() => validateChatRequest({ messages: [] })).toThrow();
    expect(() => validateChatRequest({ messages: [{ role: "user", content: "" }] })).toThrow();
  });

  it("drops an invalid address instead of throwing", () => {
    const out = validateChatRequest({ messages: [{ role: "user", content: "hi" }], address: "not-an-address" });
    expect(out.address).toBeUndefined();
  });
});

describe("buildMessages", () => {
  it("puts the system+context first, then the trimmed history in order", () => {
    const out = buildMessages("CONTEXT-BLOCK", [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ]);
    expect(out[0].role).toBe("system");
    expect(out[0].content).toContain(SYSTEM_PROMPT);
    expect(out[0].content).toContain("CONTEXT-BLOCK");
    expect(out.slice(1).map((m) => m.content)).toEqual(["q1", "a1", "q2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/chat-prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/server/chat-prompt.ts
// Pure assembly + request hygiene for the chat route. No I/O — turns a raw
// request body + a grounding-context string into the exact Groq messages array,
// and bounds the conversation so token cost stays predictable.
import type { ChatMessage, ChatRequest, ChatRole } from "@/lib/ai-chat";
import { isValidStacksAddress } from "./portfolio-snapshot";

export const MAX_HISTORY = 10;

export const SYSTEM_PROMPT = `You are "Stacks AI", a helpful assistant inside a Stacks (STX) DCA and portfolio app.

Rules:
- Answer ONLY using the data in the "Market" and "Your portfolio" context provided below. If a figure is not in the context, say you don't have it — never invent numbers, prices, or balances.
- You are read-only. You cannot place trades, create DCA plans, or move funds. When the user wants to act, point them to the Trade or DCA pages of this app.
- Do NOT give guarantees of returns or financial advice framed as certainty. You may explain trade-offs neutrally.
- Keep answers concise and concrete. Prefer the user's own numbers when relevant.
- If asked something unrelated to Stacks, crypto, or the user's portfolio, briefly decline and steer back.`;

function isValidMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== "object") return false;
  const r = (m as { role?: unknown }).role;
  const c = (m as { content?: unknown }).content;
  return (r === "user" || r === "assistant") && typeof c === "string" && c.trim().length > 0;
}

/** Keep only the most recent `max` well-formed messages, preserving order. */
export function trimHistory(messages: ChatMessage[], max = MAX_HISTORY): ChatMessage[] {
  const clean = (messages ?? []).filter(isValidMessage).map((m) => ({
    role: m.role as ChatRole,
    content: m.content,
  }));
  return clean.length > max ? clean.slice(clean.length - max) : clean;
}

/** Validate the POST body. Throws on no usable messages; drops a bad address. */
export function validateChatRequest(body: unknown): { messages: ChatMessage[]; address?: string } {
  const raw = (body as ChatRequest)?.messages;
  if (!Array.isArray(raw)) throw new Error("messages must be an array");
  const messages = trimHistory(raw as ChatMessage[]);
  if (messages.length === 0) throw new Error("no usable messages");

  const addrRaw = (body as ChatRequest)?.address;
  const address = typeof addrRaw === "string" ? addrRaw.trim() : "";
  return address && isValidStacksAddress(address)
    ? { messages, address }
    : { messages };
}

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Final Groq messages: system(prompt+context) then the conversation. */
export function buildMessages(context: string, history: ChatMessage[]): GroqMessage[] {
  return [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${context}` },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/chat-prompt.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/chat-prompt.ts src/lib/server/chat-prompt.test.ts
git commit -m "feat(ai-chat): system prompt assembly, history trim, request validation"
```

---

## Task 4: Per-IP+address rate limiter

**Files:**
- Create: `src/lib/server/chat-rate-limit.ts`

- [ ] **Step 1: Write the module** (mirrors the existing `isRateLimited` in `ai-insights-cache.ts`)

```typescript
// src/lib/server/chat-rate-limit.ts
// Sliding-window rate limit for the uncached chat route. Mirrors
// ai-insights-cache.ts:isRateLimited — degrades to "not limited" when Redis env
// is absent so local/dev still works, since Redis is the only store shared
// across Vercel function instances.
import { Redis } from "@upstash/redis";

const WINDOW_SECONDS = 60;
const MAX_PER_WINDOW = 15;

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (redis !== undefined) return redis;
  try {
    redis = Redis.fromEnv();
  } catch {
    redis = null;
  }
  return redis;
}

/** `key` is an IP (+ address when present). Returns true once over the window cap. */
export async function isChatRateLimited(key: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const redisKey = `ai-chat:rl:${key}`;
  try {
    const count = await r.incr(redisKey);
    if (count === 1) await r.expire(redisKey, WINDOW_SECONDS);
    return count > MAX_PER_WINDOW;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i chat-rate-limit || echo "no chat-rate-limit errors"`
Expected: `no chat-rate-limit errors`

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/chat-rate-limit.ts
git commit -m "feat(ai-chat): per-IP+address Redis rate limiter for the chat route"
```

---

## Task 5: Streaming route handler

**Files:**
- Create: `src/app/api/ai/chat/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/ai/chat/route.ts
import { NextResponse } from "next/server";
import Groq from "groq-sdk";
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
  async function open(model: string) {
    return groq.chat.completions.create(
      { model, messages, temperature: 0.4, max_tokens: MAX_RESPONSE_TOKENS, stream: true },
      { timeout: GROQ_TIMEOUT_MS, maxRetries: 0 }
    );
  }

  let completion;
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
```

- [ ] **Step 2: Typecheck + build the route**

Run: `npx tsc --noEmit 2>&1 | grep -iE "api/ai/chat|chat/route" || echo "no chat route errors"`
Expected: `no chat route errors`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "feat(ai-chat): streaming /api/ai/chat route with grounding + model fallback"
```

---

## Task 6: Ephemeral conversation hook

**Files:**
- Create: `src/hooks/useAIChat.ts`

- [ ] **Step 1: Write the hook**

```typescript
// src/hooks/useAIChat.ts
"use client";

import { useCallback, useRef, useState } from "react";
import { fetchChatStream, type ChatMessage } from "@/lib/ai-chat";

interface UseAIChat {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: boolean;
  send: (text: string) => Promise<void>;
}

// Ephemeral: history lives only in component state and resets on unmount/refresh.
// The full message list is resent to the server each turn (server trims it).
export function useAIChat(address?: string): UseAIChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isStreaming) return;
      setError(false);

      // Cancel any prior in-flight stream.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: ChatMessage = { role: "user", content };
      const history = [...messages, userMsg];
      // Optimistically render the user turn + an empty assistant turn to fill.
      setMessages([...history, { role: "assistant", content: "" }]);
      setIsStreaming(true);

      try {
        let acc = "";
        for await (const delta of fetchChatStream({ messages: history, address }, controller.signal)) {
          acc += delta;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: acc };
            return next;
          });
        }
        // An empty reply (e.g. immediate stream close) counts as an error.
        if (!acc.trim()) setError(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(true);
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, address]
  );

  return { messages, isStreaming, error, send };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i useAIChat || echo "no useAIChat errors"`
Expected: `no useAIChat errors`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAIChat.ts
git commit -m "feat(ai-chat): ephemeral useAIChat streaming hook"
```

---

## Task 7: Chat UI card

**Files:**
- Create: `src/components/ai/AskStacksAICard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/ai/AskStacksAICard.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { useAIChat } from "@/hooks/useAIChat";

export default function AskStacksAICard({ address }: { address?: string }) {
  const t = useTranslations("ai.chat");
  const { messages, isStreaming, error, send } = useAIChat(address);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as the stream fills.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const submit = () => {
    if (!input.trim() || isStreaming) return;
    send(input);
    setInput("");
  };

  const suggestions = t.raw("suggestions") as string[];

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={16} style={{ color: "var(--accent)" }} />
        <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{t("title")}</h3>
      </div>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>{t("disclaimer")}</p>

      <div ref={scrollRef} className="flex-1 max-h-80 overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            {!address && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("connectHint")}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { if (!isStreaming) send(s); }}
                  className="text-xs px-3 py-1.5 rounded-full glass-card shadow-sm transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className="max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed"
              style={
                m.role === "user"
                  ? { backgroundColor: "var(--accent)", color: "#fff" }
                  : { backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }
              }
            >
              {m.content || (isStreaming && i === messages.length - 1 ? <Loader2 size={14} className="animate-spin" /> : "")}
            </div>
          </div>
        ))}

        {error && (
          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>{t("error")}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={t("placeholder")}
          disabled={isStreaming}
          className="flex-1 px-3 py-2 rounded-xl text-sm outline-none disabled:opacity-60"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
        />
        <button
          onClick={submit}
          disabled={isStreaming || !input.trim()}
          className="p-2 rounded-xl text-white disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: "var(--accent)" }}
          aria-label={t("send")}
        >
          {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i AskStacksAICard || echo "no AskStacksAICard errors"`
Expected: `no AskStacksAICard errors`

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/AskStacksAICard.tsx
git commit -m "feat(ai-chat): AskStacksAICard chat UI with suggestions + streaming bubbles"
```

---

## Task 8: Wire into the AI tab + i18n

**Files:**
- Modify: `src/components/ai/AIPageContent.tsx`
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Add the en.json `ai.chat` namespace**

In `messages/en.json`, inside the `"ai"` object, after the `"action"` block added previously, insert:

```json
    "chat": {
      "title": "Ask Stacks AI",
      "disclaimer": "Informational only — not financial advice.",
      "placeholder": "Ask about STX, your portfolio, or DCA…",
      "send": "Send",
      "error": "Something went wrong. Try asking again.",
      "connectHint": "Connect your wallet for portfolio-specific answers.",
      "suggestions": [
        "What's STX doing today?",
        "How are my DCA plans?",
        "Is now a good time to DCA?"
      ]
    }
```

(Add a comma after the preceding `"action": { … }` block so the JSON stays valid.)

- [ ] **Step 2: Add the matching vi.json `ai.chat` namespace**

In `messages/vi.json`, inside the `"ai"` object, after the `"action"` block, insert:

```json
    "chat": {
      "title": "Hỏi Stacks AI",
      "disclaimer": "Chỉ mang tính tham khảo — không phải lời khuyên đầu tư.",
      "placeholder": "Hỏi về STX, danh mục của bạn, hoặc DCA…",
      "send": "Gửi",
      "error": "Đã có lỗi xảy ra. Thử hỏi lại nhé.",
      "connectHint": "Kết nối ví để nhận câu trả lời theo danh mục của bạn.",
      "suggestions": [
        "Giá STX hôm nay thế nào?",
        "DCA plan của tôi sao rồi?",
        "Giờ có nên DCA không?"
      ]
    }
```

- [ ] **Step 3: Render the card in AIPageContent**

In `src/components/ai/AIPageContent.tsx`, add the import near the other card imports:

```tsx
import AskStacksAICard from "./AskStacksAICard";
```

Then inside the `{data && ( … )}` grid block, after the `SmartAlertsCard` `<div className="lg:col-span-2">…</div>`, add a new full-width section:

```tsx
            <div className="lg:col-span-2">
              <AskStacksAICard address={isConnected && stxAddress ? stxAddress : undefined} />
            </div>
```

- [ ] **Step 4: Run the i18n parity test**

Run: `npx vitest run src/i18n/messages.test.ts`
Expected: PASS — en and vi keys match.

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: lint 0 errors; build "Compiled successfully".

- [ ] **Step 6: Commit**

```bash
git add src/components/ai/AIPageContent.tsx messages/en.json messages/vi.json
git commit -m "feat(ai-chat): mount Ask Stacks AI on the /ai tab + en/vi strings"
```

---

## Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run`
Expected: all tests pass (existing 221 + chat-context + chat-prompt suites).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors (pre-existing warnings tolerated).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: "✓ Compiled successfully"; `/api/ai/chat` appears as a function route in the output.

- [ ] **Step 4 (optional, manual): browser smoke test**

Run: `npm run dev`, open `http://localhost:3000/ai`, scroll to "Ask Stacks AI", click a suggestion, confirm a streamed reply renders. Connect a wallet and ask "How are my DCA plans?" to confirm portfolio grounding. Requires `GROQ_API_KEY` in `.env.local`. Kill port 3000 when done.

---

## Notes for the implementer

- **Existing patterns to follow:** `src/lib/server/ai-insights-cache.ts` (Redis null-tolerance), `src/lib/server/groq-client.ts` (model constants + fallback rationale), `src/components/ai/YourPositionCard.tsx` (card styling with theme CSS vars). Match them.
- **`isValidStacksAddress`** is already exported from `src/lib/server/portfolio-snapshot.ts` — reuse it, don't write a new validator.
- **Streaming, not SSE:** the route returns a plain `text/plain` stream; the client reads raw text deltas. Do not add `data:`/`event:` framing.
- **Non-custodial invariant:** the route and prompt never build, prefill, or sign a transaction. If a future task wants "draft a DCA plan", that is a separate spec (roadmap #2 was scoped read-only).
- **Theme:** use `var(--accent)`, `var(--bg-elevated)`, `var(--text-*)` — never shadcn `bg-card`/`text-muted-foreground` utilities (they're no-ops in this design system).
```
