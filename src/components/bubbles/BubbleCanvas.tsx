"use client";

import { useRef, useEffect, useCallback } from "react";
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from "d3-force";
import type { BubbleToken } from "@/hooks/useBubblesData";
import type { Timeframe } from "./TimeframeToggle";

const MIN_RADIUS = 22;
const MAX_RADIUS = 110;
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

function computeRadii(tokens: BubbleToken[], timeframe: Timeframe): number[] {
  if (tokens.length === 0) return [];
  const changes = tokens.map((t) => Math.abs(getChange(t, timeframe)));
  const minChange = Math.min(...changes);
  const maxChange = Math.max(...changes);
  const range = maxChange - minChange || 1;
  return changes.map((change) => {
    const norm = (change - minChange) / range;
    return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * norm;
  });
}

function packCircles(
  tokens: BubbleToken[],
  radii: number[],
  width: number,
  height: number
): LayoutBubble[] {
  // Use d3-force to compute non-overlapping positions
  const cx = width / 2;
  const cy = height / 2;

  const nodes: any[] = tokens.map((t, i) => ({
    id: t.id,
    token: t,
    radius: radii[i],
    x: cx + (Math.random() - 0.5) * width * 0.3,
    y: cy + (Math.random() - 0.5) * height * 0.3,
    vx: 0,
    vy: 0,
  }));

  const simulation = forceSimulation(nodes)
    .force("collide",
      forceCollide((d: any) => d.radius + 6).strength(1)
    )
    .force("center", forceCenter(cx, cy).strength(0.15))
    .force("charge", forceManyBody().strength(-300).distanceMax(500))
    .velocityDecay(0.5)
    .stop();

  // run a fixed number of ticks to stabilize layout
  const TICKS = 1000;
  for (let i = 0; i < TICKS; i++) simulation.tick();

  // Post-processing: push overlapping bubbles apart
  const maxIterations = 10;
  for (let iter = 0; iter < maxIterations; iter++) {
    let hasOverlap = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const ni = nodes[i];
        const nj = nodes[j];
        const dx = nj.x - ni.x;
        const dy = nj.y - ni.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = ni.radius + nj.radius + 2;

        if (dist < minDist) {
          hasOverlap = true;
          const angle = Math.atan2(dy, dx);
          const overlap = minDist - dist;
          const push = overlap / 2 + 0.5;

          ni.x -= Math.cos(angle) * push;
          ni.y -= Math.sin(angle) * push;
          nj.x += Math.cos(angle) * push;
          nj.y += Math.sin(angle) * push;
        }
      }
    }
    if (!hasOverlap) break;
  }

  // Constrain to canvas bounds
  const result: LayoutBubble[] = nodes.map((n) => ({
    token: n.token as BubbleToken,
    x: Math.max(n.radius, Math.min(width - n.radius, n.x)),
    y: Math.max(n.radius, Math.min(height - n.radius, n.y)),
    radius: n.radius,
  }));

  return result;
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

    const radii = computeRadii(tokens, timeframe);
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
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="absolute inset-0 cursor-pointer"
      />
    </div>
  );
}
