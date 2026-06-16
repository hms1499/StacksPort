// src/lib/domain/stacking/contracts.ts
// StackingDAO liquid-stacking contract coordinates + client-side guards.
// Pure constants — no fetch, no signing.

export const STACKING_DAO = {
  address: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG",
  name: "stacking-dao-core-v1",
} as const;

// Reserve contract passed as the `deposit` trait argument.
export const RESERVE = {
  address: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG",
  name: "reserve-v1",
} as const;

export const STSTX_TOKEN = {
  address: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG",
  name: "ststx-token",
} as const;

// Client-side UX guards. The contract enforces its own minimum; these just
// avoid a wasted signing fee on a tx that would revert and reserve STX for
// the transaction fee. All values in micro-STX (1 STX = 1_000_000).
export const MIN_STAKE_USTX = 1_000_000; // 1 STX
export const FEE_BUFFER_USTX = 500_000; // 0.5 STX kept for fees
