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

interface SimulationNode {
  id: string;
  token: BubbleToken;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
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

function drawBubbles(
  ctx: CanvasRenderingContext2D,
  bubbles: LayoutBubble[],
  timeframe: Timeframe,
  dpr: number,
  images: Record<string, HTMLImageElement | null>,
  hoveredId: string | null = null
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

    // Inner shadow: radial gradient overlay clipped to the circle
    ctx.save();
    const offsetX = b.radius * dpr * 0.12;
    const offsetY = b.radius * dpr * 0.08;
    const grad = ctx.createRadialGradient(
      b.x * dpr - offsetX,
      b.y * dpr - offsetY,
      b.radius * dpr * 0.15,
      b.x * dpr,
      b.y * dpr,
      b.radius * dpr
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.7, "rgba(0,0,0,0.12)");
    grad.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x * dpr, b.y * dpr, b.radius * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const isHovered = hoveredId === b.token.id;
    ctx.strokeStyle = isHovered ? "#ffffff" : (b.token.isStacks ? STACKS_BORDER_COLOR : color);
    ctx.lineWidth = (isHovered ? 3.5 : (b.token.isStacks ? 3 : 1.5)) * dpr;
    ctx.stroke();

    ctx.restore();

    // Ensure both symbol and percentage text fit inside the circle.
    const diameter = b.radius * 2;
    const padding = Math.max(6, Math.round(b.radius * 0.12));
    const maxTextWidth = Math.max(8, (diameter - padding * 2) * dpr);

    // Helper: set font and measure, reducing size until it fits or hits min size
    function fitFontSize(text: string, weight: string, startPx: number, minPx: number) {
      let px = startPx;
      while (px >= minPx) {
        ctx.font = `${weight} ${px}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        const w = ctx.measureText(text).width;
        if (w <= maxTextWidth) return px;
        px -= 1;
      }
      return minPx;
    }

    // Helper: truncate text with ellipsis to fit the current ctx.font
    function truncateToFit(text: string) {
      let t = text;
      if (ctx.measureText(t).width <= maxTextWidth) return t;
      while (t.length > 0) {
        t = t.slice(0, -1);
        if (ctx.measureText(t + "…").width <= maxTextWidth) return t + "…";
      }
      return "";
    }

    // Preferred sizes (in CSS px before DPR scaling)
    const prefSymbolPx = Math.min(24, Math.max(12, Math.floor(b.radius * 0.5)));
    const prefPercentPx = Math.min(16, Math.max(8, Math.floor(b.radius * 0.32)));

    // Fit symbol
    const symPx = fitFontSize(b.token.symbol, "bold", prefSymbolPx * dpr, 8 * dpr);
    ctx.font = `bold ${symPx}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    let symbolText = b.token.symbol;
    if (ctx.measureText(symbolText).width > maxTextWidth) symbolText = truncateToFit(symbolText);

    // Fit percent
    const sign = isPositive ? "+" : "";
    const pctTextRaw = `${sign}${change.toFixed(1)}%`;
    const pctPx = fitFontSize(pctTextRaw, "", prefPercentPx * dpr, 7 * dpr);
    ctx.font = `${pctPx}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    let pctText = pctTextRaw;
    if (ctx.measureText(pctText).width > maxTextWidth) pctText = truncateToFit(pctText);

    // Draw texts and optional icon stacked vertically and centered
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const img = images[b.token.id];
    const hasImage = !!img && img instanceof HTMLImageElement && img.complete;

    // Compute layout: symbol on top, image (if present) below symbol, percent at bottom
    const imgHeight = hasImage ? Math.min(b.radius * 0.9, b.radius * 0.9) : 0; // CSS px
    const spacing = Math.max(4, Math.floor(b.radius * 0.08));
    const totalTextHeight = (symPx + pctPx) / dpr + imgHeight + spacing * (hasImage ? 2 : 1);

    const symbolY = b.y - totalTextHeight / 2 + (symPx / dpr) / 2;
    const imageY = symbolY + (symPx / dpr) / 2 + spacing + imgHeight / 2;
    const percentY = imageY + imgHeight / 2 + spacing + (pctPx / dpr) / 2;

    ctx.fillStyle = b.token.isStacks ? STACKS_BORDER_COLOR : "#f1f5f9";
    ctx.font = `bold ${symPx}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillText(symbolText, b.x * dpr, symbolY * dpr);

    if (hasImage && img) {
      const imgW = imgHeight * (img.width / img.height || 1);
      const imgDrawW = Math.min(imgW, (b.radius * 2 - spacing * 2) * dpr);
      const imgDrawH = Math.min(imgHeight * dpr, (b.radius * 2 - spacing * 2) * dpr);
      ctx.save();
      // mask to circle to ensure image stays inside
      ctx.beginPath();
      ctx.arc(b.x * dpr, b.y * dpr, b.radius * dpr, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, b.x * dpr - imgDrawW / 2, imageY * dpr - imgDrawH / 2, imgDrawW, imgDrawH);
      ctx.restore();
    }

    ctx.fillStyle = color;
    ctx.font = `${pctPx}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillText(pctText, b.x * dpr, percentY * dpr);
  }
}
function packCircles(
  tokens: BubbleToken[],
  radii: number[],
  width: number,
  height: number
): LayoutBubble[] {
  const cx = width / 2;
  const cy = height / 2;

  // Scale radii down if bubbles would otherwise overfill the canvas
  const totalBubbleArea = radii.reduce((sum, r) => sum + Math.PI * r * r, 0);
  const canvasArea = Math.max(1, width * height);
  const maxFill = 0.55;
  const scaleFactor = totalBubbleArea > 0 ? Math.min(1, Math.sqrt((canvasArea * maxFill) / totalBubbleArea)) : 1;
  const scaledRadii = radii.map((r) => r * scaleFactor);

  const nodes: SimulationNode[] = tokens.map((t, i) => ({
    id: t.id,
    token: t,
    radius: scaledRadii[i],
    x: cx + (Math.random() - 0.5) * width * 0.45,
    y: cy + (Math.random() - 0.5) * height * 0.45,
    vx: 0,
    vy: 0,
  }));

  const simulation = forceSimulation(nodes)
    .force("collide", forceCollide((d: SimulationNode) => d.radius + 12).strength(1))
    .force("center", forceCenter(cx, cy).strength(0.28))
    .force("charge", forceManyBody().strength(-800).distanceMax(1000))
    .velocityDecay(0.4)
    .stop();

  const TICKS = 2000;
  for (let i = 0; i < TICKS; i++) simulation.tick();

  // Post-processing: iterative relaxation to remove any remaining overlaps
  const maxIterations = 200;
  const padding = 6;

  for (let iter = 0; iter < maxIterations; iter++) {
    let maxOverlap = 0;

    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i];

      // keep inside bounds during relaxation
      if (ni.x < ni.radius) ni.x = ni.radius + (Math.random() - 0.5) * 1.5;
      if (ni.x > width - ni.radius) ni.x = width - ni.radius - (Math.random() - 0.5) * 1.5;
      if (ni.y < ni.radius) ni.y = ni.radius + (Math.random() - 0.5) * 1.5;
      if (ni.y > height - ni.radius) ni.y = height - ni.radius - (Math.random() - 0.5) * 1.5;

      for (let j = i + 1; j < nodes.length; j++) {
        const nj = nodes[j];
        const dx = nj.x - ni.x;
        const dy = nj.y - ni.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const minDist = ni.radius + nj.radius + padding;

        if (dist < minDist) {
          const overlap = minDist - dist;
          maxOverlap = Math.max(maxOverlap, overlap);

          const nx = dx / dist;
          const ny = dy / dist;
          const push = Math.max(1, overlap * 0.6);

          const total = ni.radius + nj.radius || 1;
          const niShare = nj.radius / total;
          const njShare = ni.radius / total;

          ni.x -= nx * push * niShare;
          ni.y -= ny * push * niShare;
          nj.x += nx * push * njShare;
          nj.y += ny * push * njShare;
        }
      }
    }

    if (maxOverlap < 0.5) break;
  }

  const result: LayoutBubble[] = nodes.map((n) => ({
    token: n.token as BubbleToken,
    x: Math.max(n.radius, Math.min(width - n.radius, n.x)),
    y: Math.max(n.radius, Math.min(height - n.radius, n.y)),
    radius: n.radius,
  }));

  return result;
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
  const hoveredRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);
  const seedsRef = useRef<Record<string, number>>({});
  const imagesRef = useRef<Record<string, HTMLImageElement | null | 'loading'>>({});

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
    // ensure deterministic seeds for subtle per-bubble motion
    for (const b of bubblesRef.current) {
      if (!seedsRef.current[b.token.id]) seedsRef.current[b.token.id] = Math.random() * Math.PI * 2;
      // start loading images for tokens if not already
      const id = b.token.id;
      if (imagesRef.current[id] === undefined) {
        const imgUrl = b.token.image;
        if (imgUrl) {
          imagesRef.current[id] = 'loading';
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = imgUrl;
          img.onload = () => {
            imagesRef.current[id] = img;
            const dpr = window.devicePixelRatio || 1;
            scheduleRedraw(dpr);
          };
          img.onerror = () => {
            imagesRef.current[id] = null;
          };
        } else {
          imagesRef.current[id] = null;
        }
      }
    }
    if (ctx) drawBubbles(ctx, bubblesRef.current, timeframe, dpr, imagesRef.current as Record<string, HTMLImageElement | null>, hoveredRef.current);
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

  // Schedule a redraw with current hovered state
  function scheduleRedraw(dpr: number) {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (ctx) drawBubbles(ctx, bubblesRef.current, timeframe, dpr, imagesRef.current as Record<string, HTMLImageElement | null>, hoveredRef.current);
      rafRef.current = null;
    });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let found: string | null = null;
    for (const b of bubblesRef.current) {
      const dx = mx - b.x;
      const dy = my - b.y;
      if (Math.sqrt(dx * dx + dy * dy) <= b.radius) {
        found = b.token.id;
        break;
      }
    }
    if (found !== hoveredRef.current) {
      hoveredRef.current = found;
      const dpr = window.devicePixelRatio || 1;
      scheduleRedraw(dpr);
    }
  }

  function handleMouseLeave() {
    if (hoveredRef.current === null) return;
    hoveredRef.current = null;
    const dpr = window.devicePixelRatio || 1;
    scheduleRedraw(dpr);
  }

  // Continuous subtle motion: per-bubble sinusoidal offsets and redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let last = performance.now();

    function tick(now: number) {
      const dpr = window.devicePixelRatio || 1;
      const t = now / 1000;

      // build moved bubble positions with tiny offsets
      const moved = bubblesRef.current.map((b) => {
        const seed = seedsRef.current[b.token.id] ?? 0;
        const freq = 0.6 + (b.radius % 5) * 0.05; // variation by radius
        const ampX = Math.max(1, b.radius * 0.05);
        const ampY = Math.max(1, b.radius * 0.03);
        return {
          ...b,
          x: b.x + Math.cos(t * freq + seed) * ampX,
          y: b.y + Math.sin(t * (freq * 1.1) + seed) * ampY,
        } as LayoutBubble;
      });

      drawBubbles(ctx, moved, timeframe, dpr, imagesRef.current as Record<string, HTMLImageElement | null>, hoveredRef.current);
      last = now;
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, tokens.length]);

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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="absolute inset-0 cursor-pointer"
      />
    </div>
  );
}
