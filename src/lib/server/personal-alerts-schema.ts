// src/lib/server/personal-alerts-schema.ts
// Validates the LLM's personalized-alert JSON. Mirrors ai-insights-schema.ts:
// json_object guarantees valid JSON, not the right shape. Lenient on per-alert
// noise (drops elements with a bad enum), strict on the container.
import { z } from "zod";
import type { PersonalAlert } from "@/lib/ai-portfolio";

const lenientArray = <T extends z.ZodTypeAny>(item: T) =>
  z.array(z.unknown()).transform((arr) =>
    arr.flatMap((el) => {
      const r = item.safeParse(el);
      return r.success ? [r.data as z.infer<T>] : [];
    })
  );

const signalKindSchema = z.enum([
  "dca-runway-low",
  "dca-balance-empty",
  "dca-dip-buy",
  "pnl-gain",
  "pnl-loss",
  "sbtc-depeg",
]);

const alertSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(["opportunity", "warning", "info"]),
  priority: z.enum(["high", "medium", "low"]),
  // Which detector signal this alert is based on. Used downstream to attach the
  // right in-app CTA, then stripped. Missing/unrecognized → no CTA (the alert
  // still renders).
  signalKind: signalKindSchema.optional().catch(undefined),
});

const schema = z.object({
  alerts: lenientArray(alertSchema).default([]),
});

// Alerts carry a transient `signalKind` the caller maps to a CTA then strips —
// so the parsed shape is a PersonalAlert plus that optional field.
export type ParsedPersonalAlert = PersonalAlert & {
  signalKind?: z.infer<typeof signalKindSchema>;
};

export function parsePersonalAlerts(raw: unknown): { alerts: ParsedPersonalAlert[] } {
  return schema.parse(raw);
}
