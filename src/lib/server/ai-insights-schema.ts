// src/lib/server/ai-insights-schema.ts
// Zod schema that validates the JSON the LLM returns before it reaches the
// client. `response_format: json_object` only guarantees *valid JSON*, not the
// right shape — without this a missing `score` or null `sentiment` crashes the
// cards at render time. parseInsights() throws on structurally-broken output
// (caller falls back to a 500) but is lenient on recoverable noise: it coerces
// numeric strings, clamps the score, drops individual signals/coins with a bad
// enum, and defaults an absent kolSignals block.
import { z } from "zod";

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
  // Optional deep-link CTA. A missing or unrecognized value drops the CTA
  // (-> undefined) rather than dropping the whole alert — the model classifies
  // the destination, but the actual URL is resolved client-side from the enum.
  action: z.enum(["dca-open", "trade-swap", "view-assets"]).optional().catch(undefined),
});

const insightsSchema = z.object({
  sentiment: sentimentSchema,
  kolSignals: kolSignalsSchema,
  alerts: z.object({ items: lenientArray(alertSchema) }),
  // The model returns only an overview + one insight string per news item (by
  // index). The factual headline/url/source/image are assembled by the route
  // from our own data so the LLM can't alter or hallucinate them.
  newsDigest: z.object({
    summary: z.string(),
    insights: lenientArray(z.string()),
  }),
});

export type ParsedInsights = z.infer<typeof insightsSchema>;

/** Validates raw LLM JSON. Throws (ZodError) when structurally broken. */
export function parseInsights(raw: unknown): ParsedInsights {
  return insightsSchema.parse(raw);
}
