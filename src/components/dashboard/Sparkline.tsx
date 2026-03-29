"use client";

import { memo, useMemo } from "react";

interface SparklineProps {
  /** 24h price change percentage — used to generate a visual micro-trend */
  change24h: number | null;
  width?: number;
  height?: number;
}

/**
 * Lightweight SVG sparkline that visualizes price direction from change24h.
 * Generates a smooth 7-point curve using seeded pseudo-random walk.
 */
function Sparkline({ change24h, width = 56, height = 20 }: SparklineProps) {
  const safeChange = change24h ?? 0;
  const isPositive = safeChange >= 0;
  const color = isPositive ? "#22c55e" : "#ef4444";

  const points = useMemo(() => {
    // Generate 7 points that trend in the direction of change24h
    const count = 7;
    const trend = safeChange / 100; // normalize
    const pts: number[] = [];
    // Use a seeded walk so the same change24h always produces the same shape
    let seed = Math.abs(safeChange * 1000) | 0;
    const rand = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed / 2147483647) - 0.5;
    };

    let val = 50;
    for (let i = 0; i < count; i++) {
      const noise = rand() * 15;
      val += trend * 8 + noise;
      pts.push(Math.max(5, Math.min(95, val)));
    }
    // Ensure last point reflects overall direction
    if (isPositive && pts[pts.length - 1] < pts[0]) {
      pts[pts.length - 1] = pts[0] + Math.abs(safeChange) * 0.5;
    } else if (!isPositive && pts[pts.length - 1] > pts[0]) {
      pts[pts.length - 1] = pts[0] - Math.abs(safeChange) * 0.5;
    }
    return pts;
  }, [safeChange, isPositive]);

  if (change24h === null) return <div style={{ width, height }} />;

  // Scale points to SVG coordinates
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padding = 2;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * (width - padding * 2) + padding,
    y: ((max - p) / range) * (height - padding * 2) + padding,
  }));

  const pathD = coords
    .map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`))
    .join(" ");

  const areaD = `${pathD} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`;

  return (
    <svg width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={`sp-${isPositive ? "g" : "r"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sp-${isPositive ? "g" : "r"})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default memo(Sparkline);
