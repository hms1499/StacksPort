"use client";

import { useEffect, useRef } from "react";
import type { BubbleToken } from "@/hooks/useBubblesData";

const REFRESH_INTERVAL = 60_000; // must match useBubblesData refreshInterval

interface Props {
  tokens: BubbleToken[];
  isRefreshing: boolean;
}

export default function ReloadProgressBar({ tokens, isRefreshing }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const tokensRef = useRef(tokens);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(Date.now());

  function startAnimation() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startRef.current = Date.now();

    function tick() {
      const bar = barRef.current;
      if (!bar) return;
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 1 - elapsed / REFRESH_INTERVAL) * 100;
      bar.style.width = `${pct}%`;
      if (elapsed < REFRESH_INTERVAL) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  // Start on mount
  useEffect(() => {
    startAnimation();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restart when tokens object reference changes (= new SWR data arrived)
  useEffect(() => {
    if (tokens !== tokensRef.current) {
      tokensRef.current = tokens;
      startAnimation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 overflow-hidden"
      style={{ height: 2, zIndex: 10 }}
    >
      {/* Track */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />

      {/* Progress fill — width is driven by rAF, not React state */}
      <div
        ref={barRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: "100%",
          background: isRefreshing
            ? "rgba(255,255,255,0.45)"
            : "linear-gradient(90deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.7) 55%, rgba(168,85,247,1) 100%)",
          boxShadow: isRefreshing
            ? "0 0 5px rgba(255,255,255,0.5)"
            : "0 0 8px rgba(168,85,247,0.65)",
          transition: "background 0.3s, box-shadow 0.3s",
        }}
      />
    </div>
  );
}
