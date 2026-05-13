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

    const bar = barRef.current;
    if (bar) {
      bar.removeAttribute("data-waiting");
      bar.style.width = "100%";
    }

    function tick() {
      const b = barRef.current;
      if (!b) return;
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 1 - elapsed / REFRESH_INTERVAL) * 100;
      b.style.width = `${pct}%`;

      if (elapsed < REFRESH_INTERVAL) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Bar hit 0% — enter waiting state until new data arrives
        b.style.width = "100%";
        b.setAttribute("data-waiting", "true");
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
    <>
      <style>{`
        @keyframes bar-waiting {
          0%, 100% { opacity: 0.15; }
          50%       { opacity: 0.45; }
        }
        [data-waiting="true"] {
          animation: bar-waiting 1.2s ease-in-out infinite;
        }
      `}</style>

      <div
        className="absolute bottom-0 left-0 right-0 overflow-hidden"
        style={{ height: 4, zIndex: 10 }}
      >
        {/* Track */}
        <div
          className="absolute inset-0"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />

        {/* Progress fill — width driven by rAF; pulse driven by CSS when waiting */}
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
              : "linear-gradient(90deg, rgba(22,163,74,0.5) 0%, rgba(22,163,74,0.9) 55%, rgba(22,163,74,1) 100%)",
            boxShadow: isRefreshing
              ? "0 0 5px rgba(255,255,255,0.5)"
              : "0 0 12px rgba(22,163,74,0.9)",
            transition: "background 0.3s, box-shadow 0.3s",
          }}
        />
      </div>
    </>
  );
}
