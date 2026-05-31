// src/lib/server/groq-client.ts
// Shared Groq access for the AI routes. Both /api/ai/insights and the
// portfolio personal-alerts path used to inline the same model consts,
// timeout, `new Groq`, and primary→fallback retry. This consolidates them so
// model/timeout/fallback policy lives in exactly one place.
import Groq from "groq-sdk";

// Primary model is env-configurable; the fallback covers a model being
// deprecated/overloaded on Groq's side without a redeploy.
export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
export const GROQ_FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant";
// Bound each call so a hung/overloaded Groq fails fast instead of holding the
// function open to the platform timeout.
export const GROQ_TIMEOUT_MS = 20_000;

interface FallbackOptions {
  /** Log prefix, e.g. "AI Insights" / "Portfolio Alerts". */
  label: string;
  primary?: string;
  fallback?: string;
}

/**
 * Run `call(model)` against the primary model, transparently retrying on the
 * fallback model if the primary throws. This is the one place model-fallback
 * (and latency) policy lives. Pure w.r.t. the SDK — `call` does the I/O — so
 * the orchestration is unit-testable without a network.
 */
export async function withModelFallback(
  call: (model: string) => Promise<string>,
  opts: FallbackOptions
): Promise<string> {
  const primary = opts.primary ?? GROQ_MODEL;
  const fallback = opts.fallback ?? GROQ_FALLBACK_MODEL;
  try {
    return await call(primary);
  } catch (err) {
    console.warn(`[${opts.label}] primary model ${primary} failed, falling back to ${fallback}:`, err);
    return call(fallback);
  }
}

export interface CompleteJSONOptions {
  /** System prompt; defaults to a JSON-only analyst instruction. */
  system?: string;
  prompt: string;
  maxTokens: number;
  /** Log prefix for fallback warnings. */
  label: string;
}

const DEFAULT_SYSTEM = "Respond with valid JSON only, no markdown fences.";

/**
 * Ask Groq for a JSON response, with model fallback. Returns the parsed JSON
 * object (`unknown`) — callers apply their own zod schema. Throws if
 * GROQ_API_KEY is unset or both models fail.
 */
export async function completeJSON(opts: CompleteJSONOptions): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const groq = new Groq({ apiKey });

  const text = await withModelFallback(
    async (model) => {
      const completion = await groq.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: opts.system ?? DEFAULT_SYSTEM },
            { role: "user", content: opts.prompt },
          ],
          temperature: 0.3,
          max_tokens: opts.maxTokens,
          response_format: { type: "json_object" },
        },
        // maxRetries: 0 — the fallback model IS our retry strategy. Retrying the
        // SAME (overloaded) model rarely helps and compounds worst-case latency:
        // with maxRetries:1 a cache-miss could wait primary×2 + fallback×2 ≈ 80s
        // before degrading. One shot per model caps it at ≈40s.
        { timeout: GROQ_TIMEOUT_MS, maxRetries: 0 }
      );
      return completion.choices[0]?.message?.content ?? "{}";
    },
    { label: opts.label }
  );

  return JSON.parse(text);
}
