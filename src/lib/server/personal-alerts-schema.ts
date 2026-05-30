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

const alertSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(["opportunity", "warning", "info"]),
  priority: z.enum(["high", "medium", "low"]),
});

const schema = z.object({
  alerts: lenientArray(alertSchema).default([]),
});

export function parsePersonalAlerts(raw: unknown): { alerts: PersonalAlert[] } {
  return schema.parse(raw);
}
