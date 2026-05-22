// Fire-and-forget portfolio cache bust. Call after a tx is confirmed (not on
// submit — the on-chain state hasn't changed yet during pending). Failures are
// swallowed: a stale snapshot will self-refresh in <= 30s anyway.

import { mutate } from "swr";

export function invalidatePortfolio(address: string | undefined | null): void {
  if (!address) return;
  fetch("/api/portfolio/invalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
    keepalive: true,
  })
    .catch(() => {})
    .finally(() => {
      // Nudge any SWR consumers to refetch right away rather than wait for
      // their refresh interval.
      mutate(["portfolio-snapshot", address]);
    });
}
