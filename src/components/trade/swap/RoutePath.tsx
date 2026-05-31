import { ArrowRight } from "lucide-react";

export function RoutePath({ hops }: { hops: string[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {hops.map((hop, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}>
            {hop}
          </span>
          {i < hops.length - 1 && <ArrowRight size={10} style={{ color: 'var(--text-muted)' }} />}
        </span>
      ))}
    </div>
  );
}
