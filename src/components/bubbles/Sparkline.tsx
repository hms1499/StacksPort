"use client";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export default function Sparkline({
  data,
  width = 220,
  height = 56,
  positive,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[10px]"
        style={{ width, height, color: "var(--text-muted)" }}
      >
        no chart
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");

  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  const isPositive = positive ?? data[data.length - 1] >= data[0];
  const stroke = isPositive ? "#34d399" : "#f87171";
  const fillId = isPositive ? "sparkPos" : "sparkNeg";

  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
