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
  /** UI locale — the assistant replies in this language. */
  locale?: string;
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
