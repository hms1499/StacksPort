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
