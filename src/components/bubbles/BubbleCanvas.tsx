"use client";

import { useRef, useEffect, useCallback } from "react";
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from "d3-force";
import type { BubbleToken } from "@/hooks/useBubblesData";
import type { Timeframe } from "./TimeframeToggle";
import type { Metric } from "./MetricToggle";
import { changeForTimeframe } from "@/lib/bubbles";

const MIN_RADIUS = 22;
const MAX_RADIUS = 110;
const DEFAULT_BUBBLE_SIZE_SCALE = 1.5;
const STACKS_BORDER_COLOR = "#408A71";
const POSITIVE_COLOR = "#34d399";
const NEGATIVE_COLOR = "#f87171";

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: string,
  startPx: number,
  minPx: number,
  maxTextWidth: number
): number {
  let px = startPx;
  while (px >= minPx) {
    ctx.font = `${weight} ${px}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    if (ctx.measureText(text).width <= maxTextWidth) return px;
    px -= 1;
  }
  return minPx;
}

function truncateToFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxTextWidth: number
): string {
  if (ctx.measureText(text).width <= maxTextWidth) return text;
  let t = text;
  while (t.length > 0) {
    t = t.slice(0, -1);
    if (ctx.measureText(t + "…").width <= maxTextWidth) return t + "…";
  }
  return "";
}

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

function getMetricValue(token: BubbleToken, metric: Metric, timeframe: Timeframe): number {
  if (metric === "marketCap") return token.marketCap;
  if (metric === "volume") return token.volume24h;
  return Math.abs(changeForTimeframe(token, timeframe));
}

function computeRadii(
  tokens: BubbleToken[],
  timeframe: Timeframe,
  metric: Metric,
  sizeScale: number
): number[] {
  if (tokens.length === 0) return [];
  // For MCap/Volume, use sqrt to compress wide ranges (area-style scaling).
  const useSqrt = metric === "marketCap" || metric === "volume";
  const values = tokens.map((t) => {
    const v = getMetricValue(t, metric, timeframe);
    return useSqrt ? Math.sqrt(Math.max(0, v)) : v;
  });
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  return values.map((v) => {
    const norm = (v - minV) / range;
    return (MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * norm) * sizeScale;
  });
}

function drawBubbles(
  ctx: CanvasRenderingContext2D,
  bubbles: LayoutBubble[],
  timeframe: Timeframe,
  dpr: number,
  images: Record<string, HTMLImageElement | null>,
  hoveredId: string | null = null,
  focusedId: string | null = null,
  heldIds: Set<string> = new Set()
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const hasFocus = focusedId !== null;

  // Glow parameters keyed by absolute % change bracket (every 5%)
  // { shadowBlur (px), innerOpacity at [75%, 90%, 100%] radius }
  const GLOW_STEPS: { maxPct: number; blur: number; op75: number; op90: number; op100: number }[] = [
    { maxPct:  5, blur: 18, op75: 0.30, op90: 0.55, op100: 0.72 },
    { maxPct: 10, blur: 26, op75: 0.42, op90: 0.68, op100: 0.82 },
    { maxPct: 15, blur: 34, op75: 0.52, op90: 0.78, op100: 0.90 },
    { maxPct: 20, blur: 42, op75: 0.60, op90: 0.86, op100: 0.95 },
    { maxPct: 25, blur: 52, op75: 0.68, op90: 0.92, op100: 0.97 },
    { maxPct: 35, blur: 62, op75: 0.75, op90: 0.96, op100: 0.99 },
    { maxPct: Infinity, blur: 75, op75: 0.82, op90: 1.00, op100: 1.00 },
  ];

  function getGlow(absPct: number) {
    return GLOW_STEPS.find((s) => absPct <= s.maxPct) ?? GLOW_STEPS[GLOW_STEPS.length - 1];
  }

  for (const b of bubbles) {
    const change = changeForTimeframe(b.token, timeframe);
    const isPositive = change >= 0;
    const color = isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR;
    const glowRgb = isPositive ? "52,211,153" : "248,113,113";
    const glow = getGlow(Math.abs(change));
    const isFocused = focusedId === b.token.id;
    const isDimmed = hasFocus && !isFocused;
    const isHeld = heldIds.has(b.token.id);

    ctx.save();
    if (isDimmed) ctx.globalAlpha = 0.22;

    // Layer 1: dark base fill (near black, very faint color tint)
    ctx.beginPath();
    ctx.arc(b.x * dpr, b.y * dpr, b.radius * dpr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${glowRgb},0.06)`;
    ctx.fill();

    // Layer 2: inner rim glow — transparent center fading to bright color at edge
    ctx.save();
    const innerGrad = ctx.createRadialGradient(
      b.x * dpr, b.y * dpr, b.radius * dpr * 0.45,
      b.x * dpr, b.y * dpr, b.radius * dpr
    );
    innerGrad.addColorStop(0,    `rgba(${glowRgb},0)`);
    innerGrad.addColorStop(0.5,  `rgba(${glowRgb},0)`);
    innerGrad.addColorStop(0.75, `rgba(${glowRgb},${glow.op75})`);
    innerGrad.addColorStop(0.9,  `rgba(${glowRgb},${glow.op90})`);
    innerGrad.addColorStop(1,    `rgba(${glowRgb},${glow.op100})`);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.arc(b.x * dpr, b.y * dpr, b.radius * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Layer 3: glowing neon stroke + outer halo
    const isHovered = hoveredId === b.token.id;
    const boost = isFocused || isHovered;
    ctx.shadowBlur = (boost ? glow.blur * 1.6 : glow.blur) * dpr;
    ctx.shadowColor = color;
    ctx.strokeStyle = boost ? "#ffffff" : color;
    ctx.lineWidth = (isFocused ? 4.5 : isHovered ? 4 : 3) * dpr;
    ctx.stroke();

    // Layer 4: dashed white ring for tokens the user holds
    if (isHeld) {
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(b.x * dpr, b.y * dpr, (b.radius + 5) * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5 * dpr;
      ctx.setLineDash([5 * dpr, 4 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Ensure both symbol and percentage text fit inside the circle.
    const diameter = b.radius * 2;
    const padding = Math.max(6, Math.round(b.radius * 0.12));
    const maxTextWidth = Math.max(8, (diameter - padding * 2) * dpr);

    // Preferred sizes (in CSS px before DPR scaling)
    const prefSymbolPx = Math.min(24, Math.max(12, Math.floor(b.radius * 0.5)));
    const prefPercentPx = Math.min(16, Math.max(8, Math.floor(b.radius * 0.32)));

    // Fit symbol
    const symPx = fitFontSize(ctx, b.token.symbol, "bold", prefSymbolPx * dpr, 8 * dpr, maxTextWidth);
    ctx.font = `bold ${symPx}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    let symbolText = b.token.symbol;
    if (ctx.measureText(symbolText).width > maxTextWidth) symbolText = truncateToFit(ctx, symbolText, maxTextWidth);

    // Fit percent
    const sign = isPositive ? "+" : "";
    const pctTextRaw = `${sign}${change.toFixed(1)}%`;
    const pctPx = fitFontSize(ctx, pctTextRaw, "", prefPercentPx * dpr, 7 * dpr, maxTextWidth);
    ctx.font = `${pctPx}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    let pctText = pctTextRaw;
    if (ctx.measureText(pctText).width > maxTextWidth) pctText = truncateToFit(ctx, pctText, maxTextWidth);

    // Draw texts and optional icon stacked vertically and centered
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const img = images[b.token.id];
    const hasImage = !!img && img instanceof HTMLImageElement && img.complete;

    // Icon size: 60% of radius (CSS px)
    const imgSize = hasImage ? Math.max(8, b.radius * 0.6) : 0;
    const spacing = Math.max(4, Math.floor(b.radius * 0.06));

    // total height: percent on top, symbol middle, icon (optional) bottom
    const pctHeightCss = pctPx / dpr;
    const symHeightCss = symPx / dpr;
    const totalHeight = pctHeightCss + symHeightCss + (hasImage ? imgSize + spacing * 2 : spacing);

    const topY = b.y - totalHeight / 2;
    const pctY = topY + pctHeightCss / 2;
    const symbolY = pctY + pctHeightCss / 2 + spacing + symHeightCss / 2;
    const imageY = symbolY + symHeightCss / 2 + spacing + imgSize / 2;

    // Draw percent (subprint) above the symbol
    ctx.fillStyle = color;
    ctx.font = `${pctPx}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillText(pctText, b.x * dpr, pctY * dpr);

    // Draw symbol (word)
    ctx.fillStyle = b.token.isStacks ? STACKS_BORDER_COLOR : "#f1f5f9";
    ctx.font = `bold ${symPx}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillText(symbolText, b.x * dpr, symbolY * dpr);

    // Draw icon under the symbol
    if (hasImage && img) {
      const imgDrawH = Math.min(imgSize * dpr, (b.radius * 2 - spacing * 2) * dpr);
      const imgW = img.width / img.height || 1;
      const imgDrawW = Math.min(imgDrawH * imgW, (b.radius * 2 - spacing * 2) * dpr);
      ctx.save();
      // mask to circle to ensure image stays inside
      ctx.beginPath();
      ctx.arc(b.x * dpr, b.y * dpr, b.radius * dpr, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, b.x * dpr - imgDrawW / 2, imageY * dpr - imgDrawH / 2, imgDrawW, imgDrawH);
      ctx.restore();
    }
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
  const maxFill = 0.72;
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

  // d3-force converges well within a few hundred ticks for this node count;
  // the relaxation pass below is the real overlap guarantee, so 2000 was
  // wasted main-thread work.
  const TICKS = 500;
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
  metric: Metric;
  focusedId?: string | null;
  heldIds?: Set<string>;
  paused?: boolean;
  density?: number;
  onBubbleClick: (token: BubbleToken, x: number, y: number) => void;
}

export default function BubbleCanvas({
  tokens,
  timeframe,
  metric,
  focusedId = null,
  heldIds,
  paused = false,
  density = DEFAULT_BUBBLE_SIZE_SCALE,
  onBubbleClick,
}: BubbleCanvasProps) {
  const heldRef = useRef<Set<string>>(heldIds ?? new Set());
  heldRef.current = heldIds ?? new Set();
  const focusedRef = useRef<string | null>(focusedId);
  focusedRef.current = focusedId;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<LayoutBubble[]>([]);
  const hoveredRef = useRef<string | null>(null);
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

    const radii = computeRadii(tokens, timeframe, metric, density);
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
          };
          img.onerror = () => {
            imagesRef.current[id] = null;
          };
        } else {
          imagesRef.current[id] = null;
        }
      }
    }
    if (ctx) drawBubbles(ctx, bubblesRef.current, timeframe, dpr, imagesRef.current as Record<string, HTMLImageElement | null>, hoveredRef.current, focusedRef.current, heldRef.current);
  }, [tokens, timeframe, metric, density]);

  useEffect(() => {
    layout();
  }, [layout]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // layout() runs a synchronous d3-force pack + O(n²) relaxation, so debounce
    // the observer — otherwise dragging a window edge re-packs on every frame.
    let t: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => layout(), 150);
    });
    observer.observe(container);
    return () => {
      if (t) clearTimeout(t);
      observer.disconnect();
    };
  }, [layout]);

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
    hoveredRef.current = found;
  }

  function handleMouseLeave() {
    hoveredRef.current = null;
  }

  // While paused the rAF loop below doesn't run, so focus/dim/held changes
  // wouldn't repaint. Redraw a single static frame whenever those inputs change
  // (and on entering paused state).
  useEffect(() => {
    if (!paused) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    drawBubbles(
      ctx,
      bubblesRef.current,
      timeframe,
      dpr,
      imagesRef.current as Record<string, HTMLImageElement | null>,
      hoveredRef.current,
      focusedRef.current,
      heldRef.current
    );
  }, [paused, focusedId, heldIds, timeframe]);

  // Continuous subtle motion: per-bubble sinusoidal offsets and redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (paused) return;

    function tick(now: number) {
      const dpr = window.devicePixelRatio || 1;
      const t = now / 1000;

      const moved = bubblesRef.current.map((b) => {
        const seed = seedsRef.current[b.token.id] ?? 0;

        // Bubble nhỏ nổi nhanh hơn bubble lớn (mass proportional)
        const massScale = 1 - (b.radius / (MAX_RADIUS * DEFAULT_BUBBLE_SIZE_SCALE)) * 0.45;
        const freqBase = (0.28 + massScale * 0.22);

        // Hai sin wave chồng nhau → quỹ đạo lemniscate tự nhiên
        const ampX = b.radius * 0.10;
        const ampY = b.radius * 0.07;
        const driftAmp = b.radius * 0.04;

        const x = b.x
          + Math.cos(t * freqBase + seed) * ampX
          + Math.cos(t * freqBase * 0.37 + seed * 1.7) * driftAmp;
        const y = b.y
          + Math.sin(t * freqBase * 1.13 + seed + Math.PI * 0.4) * ampY
          + Math.sin(t * freqBase * 0.29 + seed * 2.1) * driftAmp;

        return { ...b, x, y } as LayoutBubble;
      });

      drawBubbles(ctx as CanvasRenderingContext2D, moved, timeframe, dpr, imagesRef.current as Record<string, HTMLImageElement | null>, hoveredRef.current, focusedRef.current, heldRef.current);
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, tokens.length, paused]);

  function hitTest(mx: number, my: number): LayoutBubble | null {
    for (const b of bubblesRef.current) {
      const dx = mx - b.x;
      const dy = my - b.y;
      if (Math.sqrt(dx * dx + dy * dy) <= b.radius) return b;
    }
    return null;
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) onBubbleClick(hit.token, e.clientX, e.clientY);
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || e.changedTouches.length === 0) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(touch.clientX - rect.left, touch.clientY - rect.top);
    if (hit) onBubbleClick(hit.token, touch.clientX, touch.clientY);
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        data-bubble-canvas="true"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchEnd={handleTouchEnd}
        className="absolute inset-0 cursor-pointer"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
