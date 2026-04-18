"use client";

interface MiniSparklineProps {
  points?: number[];          // y-values (any unit); x is index
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
}

export default function MiniSparkline({
  points,
  width = 160,
  height = 40,
  className,
  ariaLabel = "price sparkline",
}: MiniSparklineProps) {
  const padding = 2;

  if (!points || points.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label="price chart coming soon"
      >
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="var(--text-muted)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.5}
        />
        <text
          x={width / 2}
          y={height / 2 - 4}
          textAnchor="middle"
          fontSize="9"
          fill="var(--text-muted)"
        >
          chart coming soon
        </text>
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (points.length - 1);

  const d = points
    .map((y, i) => {
      const px = padding + i * stepX;
      const py = padding + ((max - y) / range) * (height - padding * 2);
      return `${i === 0 ? "M" : "L"} ${px.toFixed(2)} ${py.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
