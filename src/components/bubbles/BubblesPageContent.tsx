"use client";

import { useState, useCallback } from "react";
import { useBubblesData } from "@/hooks/useBubblesData";
import type { BubbleToken } from "@/hooks/useBubblesData";
import BubbleCanvas from "./BubbleCanvas";
import BubbleTooltip from "./BubbleTooltip";
import TimeframeToggle, { type Timeframe } from "./TimeframeToggle";

export default function BubblesPageContent() {
  const { data: tokens, isLoading, error } = useBubblesData();
  const [timeframe, setTimeframe] = useState<Timeframe>("24h");
  const [selected, setSelected] = useState<{
    token: BubbleToken;
    x: number;
    y: number;
  } | null>(null);

  const handleBubbleClick = useCallback(
    (token: BubbleToken, x: number, y: number) => {
      setSelected((prev) =>
        prev?.token.id === token.id ? null : { token, x, y }
      );
    },
    []
  );

  const handleCloseTooltip = useCallback(() => setSelected(null), []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <h1
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Crypto Bubbles
        </h1>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>

      <div className="flex-1 relative bg-black">
        {isLoading && !tokens && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {error && !tokens && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Failed to load data. Retrying...
            </p>
          </div>
        )}

        {tokens && tokens.length > 0 && (
          <BubbleCanvas
            tokens={tokens}
            timeframe={timeframe}
            onBubbleClick={handleBubbleClick}
          />
        )}

        {selected && (
          <BubbleTooltip
            token={selected.token}
            x={selected.x}
            y={selected.y}
            timeframe={timeframe}
            onClose={handleCloseTooltip}
          />
        )}
      </div>

      {error && tokens && (
        <div
          className="px-4 py-1.5 text-center text-xs"
          style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)" }}
        >
          Data may be outdated
        </div>
      )}
    </div>
  );
}
