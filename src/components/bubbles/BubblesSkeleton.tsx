"use client";

const PLACEHOLDERS = [
  { top: "18%", left: "22%", size: 96 },
  { top: "30%", left: "52%", size: 140 },
  { top: "58%", left: "30%", size: 110 },
  { top: "62%", left: "68%", size: 80 },
  { top: "44%", left: "80%", size: 64 },
  { top: "20%", left: "72%", size: 72 },
  { top: "70%", left: "50%", size: 60 },
  { top: "40%", left: "12%", size: 56 },
];

export default function BubblesSkeleton() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PLACEHOLDERS.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-pulse"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}
