"use client";

import { useRef, useEffect, useCallback } from "react";
import type { BubbleToken } from "@/hooks/useBubblesData";
import type { Timeframe } from "./TimeframeToggle";

const MIN_RADIUS = 20;
const MAX_RADIUS = 120;
const STACKS_BORDER_COLOR = "#408A71";
const POSITIVE_COLOR = "#34d399";
const NEGATIVE_COLOR = "#f87171";

interface LayoutBubble {
  token: BubbleToken;
  x: number;
  y: number;
  radius: number;
}

function getChange(token: BubbleToken, tf: Timeframe): number {
  if (tf === "1h") return token.change1h;
  if (tf === "7d") return token.change7d;
  return token.change24h;
}

function computeRadii(tokens: BubbleToken[]): number[] {
  if (tokens.length === 0) return [];
  const caps = tokens.map((t) => t.marketCap);
  const logMin = Math.log(Math.max(Math.min(...caps), 1));
  const logMax = Math.log(Math.max(...caps));
  const range = logMax - logMin || 1;
  return caps.map((cap) => {
    const norm = (Math.log(Math.max(cap, 1)) - logMin) / range;
    return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * norm;
  });
}

function packCircles(
  tokens: BubbleToken[],
  radii: number[],
  width: number,
  height: number
): LayoutBubble[] {
  const cx = width / 2;
  const cy = height / 2;
  const bubbles: LayoutBubble[] = [];

  const indices = radii.map((_, i) => i).sort((a, b) => radii[b] - radii[a]);

  for (const idx of indices) {
    const r = radii[idx];
    if (bubbles.length === 0) {
      bubbles.push({ token: tokens[idx], x: cx, y: cy, radius: r });
      continue;
    }

    let bestX = cx;
    let bestY = cy;
    let bestDist = Infinity;
    let placed = false;

    for (let angle = 0; angle < Math.PI * 20; angle += 0.3) {
      const dist = r + angle * 4;
      const tryX = cx + Math.cos(angle) * dist;
      const tryY = cy + Math.sin(angle) * dist;

      let overlaps = false;
      for (const b of bubbles) {
        const dx = tryX - b.x;
        const dy = tryY - b.y;
        if (Math.sqrt(dx * dx + dy * dy) < r + b.radius + 2) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        const d = Math.sqrt((tryX - cx) ** 2 + (tryY - cy) ** 2);
        if (d < bestDist) {
          bestDist = d;
          bestX = tryX;
          bestY = tryY;
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      bestX = cx + (Math.random() - 0.5) * width * 0.8;
      bestY = cy + (Math.random() - 0.5) * height * 0.8;
    }

    bubbles.push({ token: tokens[idx], x: bestX, y: bestY, radius: r });
  }

  return bubbles;
}

function drawBubbles(
  ctx: CanvasRenderingContext2D,
  bubbles: LayoutBubble[],
  timeframe: Timeframe,
  dpr: number
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const b of bubbles) {
    const change = getChange(b.token, timeframe);
    const isPositive = change >= 0;
    const color = isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR;
    const opacity = Math.min(0.1 + Math.abs(change) * 0.01, 0.35);

    ctx.save();

    if (b.token.isStacks) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(64,138,113,0.4)";
    }

    ctx.beginPath();
    ctx.arc(b.x * dpr, b.y * dpr, b.radius * dpr, 0, Math.PI * 2);
    ctx.fillStyle =
      color +
      Math.round(opacity * 255)
        .toString(16)
        .padStart(2, "0");
    ctx.fill();

    ctx.strokeStyle = b.token.isStacks ? STACKS_BORDER_COLOR : color;
    ctx.lineWidth = (b.token.isStacks ? 3 : 1.5) * dpr;
    ctx.stroke();

    ctx.restore();

    const fontSize = Math.max(10, Math.min(b.radius * 0.35, 16));
    ctx.font = `bold ${fontSize * dpr}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = b.token.isStacks ? STACKS_BORDER_COLOR : "#f1f5f9";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.token.symbol, b.x * dpr, (b.y - fontSize * 0.3) * dpr);

    const smallSize = Math.max(8, fontSize * 0.7);
    ctx.font = `${smallSize * dpr}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = color;
    const sign = isPositive ? "+" : "";
    ctx.fillText(
      `${sign}${change.toFixed(1)}%`,
      b.x * dpr,
      (b.y + fontSize * 0.5) * dpr
    );
  }
}

interface BubbleCanvasProps {
  tokens: BubbleToken[];
  timeframe: Timeframe;
  onBubbleClick: (token: BubbleToken, x: number, y: number) => void;
}

export default function BubbleCanvas({
  tokens,
  timeframe,
  onBubbleClick,
}: BubbleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<LayoutBubble[]>([]);

  const layout = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || tokens.length === 0) return;

    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const radii = computeRadii(tokens);
    bubblesRef.current = packCircles(tokens, radii, width, height);

    const ctx = canvas.getContext("2d");
    if (ctx) drawBubbles(ctx, bubblesRef.current, timeframe, dpr);
  }, [tokens, timeframe]);

  useEffect(() => {
    layout();
  }, [layout]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => layout());
    observer.observe(container);
    return () => observer.disconnect();
  }, [layout]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const b of bubblesRef.current) {
      const dx = mx - b.x;
      const dy = my - b.y;
      if (Math.sqrt(dx * dx + dy * dy) <= b.radius) {
        onBubbleClick(b.token, e.clientX, e.clientY);
        return;
      }
    }
  }

  return (
    <div ref={containerRef} className="w-full flex-1 min-h-[400px] relative">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="absolute inset-0 cursor-pointer"
      />
    </div>
  );
}
