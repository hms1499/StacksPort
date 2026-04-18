// src/lib/dca-preview.ts
// Pure helpers for DCA preview calculations — used by LivePreviewCard,
// DCAHeroStats, and PlanCardRow. No side effects, no React.

import { INTERVALS, blocksToInterval } from "./dca";

const STACKS_BLOCK_SECONDS = 600; // ~10 min target (Nakamoto); rough ETA use only

/**
 * Number of swaps the plan can afford given deposit and per-swap amount.
 * Returns 0 if inputs are invalid.
 */
export function swapsCount(depositStx: number, amountStx: number): number {
  if (amountStx <= 0 || depositStx < amountStx) return 0;
  return Math.floor(depositStx / amountStx);
}

/**
 * Estimated calendar end-date for a DCA plan.
 * Returns a Date that is `swaps * intervalBlocks * 10min` from now, or null on invalid.
 */
export function estimateEndDate(
  depositStx: number,
  amountStx: number,
  intervalKey: keyof typeof INTERVALS,
): Date | null {
  const swaps = swapsCount(depositStx, amountStx);
  if (swaps <= 0) return null;
  const blocks = INTERVALS[intervalKey];
  const seconds = swaps * blocks * STACKS_BLOCK_SECONDS;
  return new Date(Date.now() + seconds * 1000);
}

/**
 * Total protocol fee (in STX) across all planned swaps = swaps × amount × 0.3%.
 */
export function totalProtocolFee(depositStx: number, amountStx: number): number {
  const swaps = swapsCount(depositStx, amountStx);
  return swaps * amountStx * 0.003;
}

/**
 * Short human-readable countdown for blocks remaining.
 * e.g. 0 → "Ready", 1 → "~10m", 30 → "~5h", 200 → "~33h", 1500 → "~10d".
 */
export function formatBlocksCountdown(blocks: number): string {
  if (blocks <= 0) return "Ready";
  const mins = blocks * 10;
  if (mins < 60)  return `~${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `~${hours}h`;
  const days = Math.round(hours / 24);
  return `~${days}d`;
}

/**
 * Pick the shortest countdown across a user's active plans.
 * Returns null if no active plans with remaining swaps.
 */
export function nextSwapCountdown(
  plans: Array<{ active: boolean; leb: number; ivl: number; bal: number; amt: number }>,
  currentBlock: number,
): string | null {
  const remaining = plans
    .filter((p) => p.active && p.bal >= p.amt && p.amt > 0)
    .map((p) => {
      const nextBlock = p.leb === 0 ? currentBlock : p.leb + p.ivl;
      return Math.max(0, nextBlock - currentBlock);
    });
  if (remaining.length === 0) return null;
  return formatBlocksCountdown(Math.min(...remaining));
}

export { blocksToInterval };
