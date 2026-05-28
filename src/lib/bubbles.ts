import type { BubbleToken } from "@/hooks/useBubblesData";
import type { Timeframe } from "@/components/bubbles/TimeframeToggle";

/** Single source of truth for mapping a timeframe to its % change field. */
export function changeForTimeframe(token: BubbleToken, tf: Timeframe): number {
  switch (tf) {
    case "1h":
      return token.change1h;
    case "7d":
      return token.change7d;
    case "30d":
      return token.change30d;
    case "1y":
      return token.change1y;
    default:
      return token.change24h;
  }
}
