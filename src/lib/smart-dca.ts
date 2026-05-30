// src/lib/smart-dca.ts
// Shared types + pure validation for the Smart DCA ("buy the dip") feature.
// Keeper has its own copy of the decision math; this is the frontend/API side.

export interface SmartDcaConfig {
  owner: string;
  thresholdBps: number;
  windowDays: number;
  maxDeferIntervals: number;
  createdAt: number;
}

export const SMART_DCA_LIMITS = {
  thresholdBps: { min: 0, max: 5000 },
  windowDays: { min: 1, max: 30 },
  maxDeferIntervals: { min: 0, max: 10 },
} as const;

export interface ConfigInput {
  planId: number;
  thresholdBps: number;
  windowDays: number;
  maxDeferIntervals: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateConfigInput(input: ConfigInput): ValidationResult {
  const errors: string[] = [];
  const { planId, thresholdBps, windowDays, maxDeferIntervals } = input;
  if (!Number.isInteger(planId) || planId < 0) errors.push("planId must be a non-negative integer");
  const t = SMART_DCA_LIMITS.thresholdBps;
  if (!(thresholdBps >= t.min && thresholdBps <= t.max)) errors.push("thresholdBps must be 0..5000");
  const w = SMART_DCA_LIMITS.windowDays;
  if (!Number.isInteger(windowDays) || windowDays < w.min || windowDays > w.max)
    errors.push("windowDays must be 1..30");
  const d = SMART_DCA_LIMITS.maxDeferIntervals;
  if (!Number.isInteger(maxDeferIntervals) || maxDeferIntervals < d.min || maxDeferIntervals > d.max)
    errors.push("maxDeferIntervals must be 0..10");
  return { ok: errors.length === 0, errors };
}

// current/avg - 1, or null when avg is non-positive.
export function premium(current: number, avg: number): number | null {
  if (!(avg > 0)) return null;
  return current / avg - 1;
}
