# Ask Stacks AI — Conversational Chat — Design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)
**Feature area:** AI tab (`/ai`)

## Goal

Add a **read-only conversational assistant** to the AI tab. Users can ask
free-form questions ("What's STX doing today?", "How are my DCA plans?") and get
streamed, factual answers grounded in the same data the rest of the tab already
uses — the shared market snapshot plus, when a wallet is connected, the user's
personal portfolio snapshot. This is feature #2 of the AI roadmap; it builds on
the grounding foundation laid by feature #1 (`ai-portfolio-grounding`) and the
deep-link CTAs shipped alongside it.

## Decisions (locked during brainstorming)

- **Scope:** **read-only Q&A only.** The assistant answers questions and may
  *suggest* next steps (and deep-link to `/dca` / `/trade`), but never builds,
  prefills, or broadcasts a transaction. Non-custodial model is preserved.
- **Surface:** a single **full-width chat section at the bottom of the existing
  `/ai` grid** (`AskStacksAICard`). No new route, no floating widget.
- **Engine:** **Groq SDK streaming + context-stuffing.** Reuse the existing
  `groq-sdk` dependency with `stream: true`. Each turn assembles a compact
  grounding-context block from the two snapshots and injects it as the system
  prompt. No Vercel AI SDK, no tool-calling (only two fixed data sources).
- **History:** **ephemeral.** The client holds the message list in component
  state and resends it each turn. No persistence in v1 (resets on refresh).
- **Numbers come from data, never the model.** The grounding context is built
  from real snapshot values; the system prompt forbids inventing figures —
  mirroring the anti-hallucination posture of the insights/personal-alerts paths.

## Non-goals (YAGNI)

- No transaction building, prefilling, or signing of any kind.
- No conversation persistence, no cross-session history, no "saved chats".
- No Vercel AI SDK migration; no AI Gateway; no tool/function calling.
- No streaming-mid-flight model retry (fallback only on initial connect error).
- No changes to the existing global `/api/ai/insights` or
  `/api/ai/portfolio-insights` routes or their cards.
- No voice, no file upload, no image generation.

## Architecture

New units, each with a single responsibility and independently testable. The
streaming route is thin wiring; all the logic that *can* be pure, *is* pure.

### Server

**`src/lib/server/chat-context.ts`** — the key isolated unit. Pure function:
snapshots → a compact, factual, plain-text grounding block.

```
buildChatContext(market: MarketSnapshot, portfolio: PortfolioSnapshot | null): string
```

- Market section (always): STX price + 24h/7d change, BTC price, Fear & Greed
  value + classification, a one-line sentiment cue if present, top trending
  tokens (symbols only).
- Portfolio section (only when `portfolio` non-null): total value, top holdings
  with values, active DCA plans (id, pair, amount/interval, balance/runway), and
  PnL highlights. Omitted entirely when no wallet → the block ends with a note
  that portfolio data is unavailable until the user connects a wallet.
- Defensive on missing/null fields (same tolerance as the snapshot consumers):
  absent stats degrade to "N/A", never throw.

**`src/lib/server/chat-prompt.ts`** — pure assembly + request hygiene:

- `SYSTEM_PROMPT` constant: persona ("Stacks AI, an assistant for a Stacks DCA
  app"), rules — answer only from the provided context, never invent numbers,
  may suggest using the DCA/Trade pages, keep answers concise, append no
  guarantees of returns, decline non-Stacks/off-topic asks briefly.
- `buildMessages(context, history)`: returns the final Groq `messages` array —
  `system` = SYSTEM_PROMPT + context block, followed by the trimmed history.
- `trimHistory(messages, max)`: keep only the most recent `max` turns
  (default 10) to bound token cost; drop anything malformed.
- `validateChatRequest(body)`: returns `{ messages, address }` or throws — each
  message must have a valid `role` ("user" | "assistant") and non-empty string
  `content`; `address` optional, validated via the existing
  `isValidStacksAddress`.

**`src/lib/ai-chat.ts`** — client-safe shared types: `ChatMessage`
(`{ role: "user" | "assistant"; content: string }`), request/response shapes,
and the `fetchChatStream` helper (POSTs and yields text deltas).

**`POST /api/ai/chat`** — streaming route handler (thin):

1. `validateChatRequest` the body (400 on bad shape).
2. Rate-limit per `IP + address` via the existing Redis sliding-window pattern
   used by `isRateLimited` (429 on exceed). Chat is uncached, so this is the
   only cost guard.
3. If `GROQ_API_KEY` unset → 503 with a friendly "AI unavailable" payload.
4. `Promise.all([getMarketSnapshot(), address ? getPortfolioSnapshot(address) : null])`.
5. `buildChatContext` → `buildMessages` → Groq `chat.completions.create({ stream: true, ... })`.
6. Stream the assistant deltas back as a `ReadableStream` of UTF-8 text.
7. On an *initial* connect/throw, retry once on the fallback model (reusing the
   model constants from `groq-client.ts`); errors after the stream opens end the
   stream cleanly.

### Client

**`src/hooks/useAIChat.ts`** — owns the ephemeral conversation:

- State: `messages: ChatMessage[]`, `isStreaming`, `error`.
- `send(text)`: optimistically appends the user message, opens the stream via
  `fetchChatStream`, appends an assistant message that fills in as deltas
  arrive; sets `error` on failure; `AbortController` to cancel on unmount/new send.
- No persistence; resets with the component.

**`src/components/ai/AskStacksAICard.tsx`** — the chat UI:

- Header (Sparkles + title + a short "informational, not financial advice"
  disclaimer line).
- Scrollable message list; user vs assistant bubbles using existing theme vars
  (`--accent`, `--bg-elevated`, `--text-*`) for light/dark parity.
- A blinking/streaming indicator while the assistant message fills.
- Suggested-prompt chips when the conversation is empty (localized).
- Input row with send button; disabled while streaming; Enter to send.
- Wallet-aware: when disconnected, a subtle hint that connecting a wallet
  unlocks portfolio-specific answers.

**Wiring:** render `<AskStacksAICard />` as a full-width (`lg:col-span-2`)
section at the bottom of the data grid in `AIPageContent.tsx`, passing
`stxAddress` when connected.

### i18n

New `ai.chat.*` namespace in both `messages/en.json` and `messages/vi.json`:
`title`, `placeholder`, `send`, `disclaimer`, `error`, `connectHint`, and a
`suggestions` array (e.g. "STX price today?", "How are my DCA plans?",
"Is now a good time to DCA?"). Must keep the en/vi parity test green.

## Data flow

```
user types ─▶ useAIChat.send ─▶ POST /api/ai/chat { messages, address? }
                                    │
        validate ─▶ rate-limit ─▶ snapshots ─▶ buildChatContext ─▶ buildMessages
                                    │
                          Groq stream:true ─▶ ReadableStream(text deltas)
                                    │
   useAIChat appends deltas to the assistant message ─▶ AskStacksAICard renders live
```

## Error handling

- **Bad request shape** → 400; UI shows a generic error and keeps the input.
- **Rate limited** → 429; UI shows "Too many questions, try again shortly".
- **No GROQ key / Groq down (both models)** → 503; UI shows "AI is temporarily
  unavailable".
- **Stream breaks mid-answer** → the partial answer stays; UI surfaces a retry.
- **No wallet** → market-only context; assistant invites connecting a wallet for
  portfolio answers (never errors).

## Testing

- **`chat-context.test.ts`** — snapshots → expected compact text: full market +
  portfolio; market-only (null portfolio); missing/null fields degrade to "N/A"
  without throwing; numbers in the block match the snapshot inputs.
- **`chat-prompt.test.ts`** — `trimHistory` caps to N most recent and drops
  malformed entries; `validateChatRequest` accepts a valid body and rejects bad
  roles / empty content / invalid address; `buildMessages` puts system+context
  first and history after, in order.
- The streaming route is integration-shaped; v1 covers it via its pure pieces
  above (context, prompt, validation). Gate: `npm test` + `npm run build` +
  `npm run lint` (0 errors) + en/vi parity test green.

## Commit plan (fine-grained, each commit green)

1. `ai-chat.ts` shared types + `chat-context.ts` builder **+ tests** (pure).
2. `chat-prompt.ts` (system prompt, `buildMessages`, `trimHistory`,
   `validateChatRequest`) **+ tests** (pure).
3. `POST /api/ai/chat` streaming route (wiring) + rate-limit helper.
4. `useAIChat` hook.
5. `AskStacksAICard` component.
6. Wire into `AIPageContent` + `ai.chat` i18n (en + vi).

## Open considerations (decided, recorded for traceability)

- **Cost:** chat is uncached and unbounded per question; the per-IP+address
  rate limit + history trim + response `max_tokens` are the guard. Acceptable
  for v1; revisit if abuse appears.
- **Persistence:** deliberately omitted; if users ask for saved chats later,
  add a Redis-per-address store behind the same hook interface without touching
  the route's grounding logic.
