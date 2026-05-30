// src/lib/server/ai-insights-schema.ts
// Zod schema that validates the JSON the LLM returns before it reaches the
// client. `response_format: json_object` only guarantees *valid JSON*, not the
// right shape — without this a missing `score` or null `sentiment` crashes the
// cards at render time. parseInsights() throws on structurally-broken output
// (caller falls back to a 500) but is lenient on recoverable noise: it coerces
// numeric strings, clamps the score, drops individual signals/coins with a bad
// enum, and defaults an absent kolSignals block.
import { z } from "zod";
import type { AIInsightsResponse } from "@/lib/ai";

const sentimentType = z.enum(["bullish", "bearish", "neutral"]);

// Drop array elements that fail validation instead of failing the whole parse.
const lenientArray = <T extends z.ZodTypeAny>(item: T) =>
  z.array(z.unknown()).transform((arr) =>
    arr.flatMap((el) => {
      const r = item.safeParse(el);
      return r.success ? [r.data as z.infer<T>] : [];
    })
  );

const signalSchema = z.object({
  label: z.string(),
  type: sentimentType,
});

const sentimentSchema = z.object({
  summary: z.string(),
  score: z.coerce.number().pipe(z.number().min(-100).max(100).catch((ctx) => {
    // value was numeric but out of range — clamp rather than reject
    return Math.max(-100, Math.min(100, ctx.input as number));
  })),
  fearGreedValue: z.coerce.number(),
  signals: lenientArray(signalSchema),
});

const coinSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  galaxyScore: z.coerce.number(),
  socialVolume: z.coerce.number(),
  sentiment: sentimentType,
  insight: z.string(),
});

const kolSignalsSchema = z
  .object({
    summary: z.string(),
    coins: lenientArray(coinSchema),
  })
  .default({ summary: "", coins: [] });

const alertSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(["opportunity", "warning", "info"]),
  priority: z.enum(["high", "medium", "low"]),
});

const newsItemSchema = z.object({
  headline: z.string(),
  insight: z.string(),
  source: z.string(),
  url: z.string(),
  imageUrl: z.string().optional(),
});

const insightsSchema = z.object({
  sentiment: sentimentSchema,
  kolSignals: kolSignalsSchema,
  alerts: z.object({ items: lenientArray(alertSchema) }),
  newsDigest: z.object({
    summary: z.string(),
    items: lenientArray(newsItemSchema),
  }),
});

export type ParsedInsights = Omit<AIInsightsResponse, "generatedAt">;

/** Validates raw LLM JSON. Throws (ZodError) when structurally broken. */
export function parseInsights(raw: unknown): ParsedInsights {
  return insightsSchema.parse(raw);
}
