// Pure combiner for a user's total stacking position across liquid stacking
// (stSTX via StackingDAO) and native PoX. No fetch — inputs are already-read
// values; the component wires the reads.

export interface StackingPositionInput {
  /** stSTX balance in stSTX (human) units; 0 if none held. */
  stStxBalance: number;
  /** micro-STX per 1 stSTX (from fetchStxPerStStx), or null if unavailable. */
  microStxPerStStx: number | null;
  /** Native PoX locked STX in STX (human) units; 0 if none. */
  poxLockedStx: number;
  /** Whether native PoX reports an active stacking lock. */
  poxIsStacking: boolean;
}

export interface StackingSummary {
  /** stSTX position valued in STX; 0 if no stSTX, null if held but rate unknown. */
  liquidStx: number | null;
  /** STX locked in native PoX (0 when not actively stacking). */
  poxStx: number;
  /** Combined STX known to be earning: (liquidStx ?? 0) + poxStx. */
  totalStx: number;
  /** True when either liquid stSTX is held or PoX is active. */
  isEarning: boolean;
}

export function summarizeStackingPosition(input: StackingPositionInput): StackingSummary {
  const hasLiquid = input.stStxBalance > 0;
  const liquidStx = !hasLiquid
    ? 0
    : input.microStxPerStStx === null
    ? null
    : (input.stStxBalance * input.microStxPerStStx) / 1_000_000;
  const poxStx = input.poxIsStacking ? input.poxLockedStx : 0;
  const isEarning = hasLiquid || input.poxIsStacking;
  const totalStx = (liquidStx ?? 0) + poxStx;
  return { liquidStx, poxStx, totalStx, isEarning };
}
