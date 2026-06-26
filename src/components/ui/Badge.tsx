import { cn } from "@/lib/utils";

type VariantConfig = { className: string; style?: React.CSSProperties };

const variants: Record<string, VariantConfig> = {
  default: { className: "", style: { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' } },
  success: { className: "bg-green-50 text-green-600" },
  warning: { className: "bg-yellow-50 text-yellow-600" },
  danger:  { className: "bg-red-50 text-red-600" },
  info:    { className: "bg-blue-50 text-blue-600" },
  brand:   { className: "", style: { backgroundColor: 'var(--accent-glow)', color: 'var(--accent-text)' } },
} as const;

type Variant = keyof typeof variants;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  dot?: boolean;
}

export default function Badge({ variant = "default", dot, className, style, children, ...props }: BadgeProps) {
  const config = variants[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
        config.className,
        className
      )}
      style={{ ...config.style, ...style }}
      {...props}
    >
      {dot && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          variant === "success" && "bg-green-500",
          variant === "warning" && "bg-yellow-500",
          variant === "danger"  && "bg-red-500",
          variant === "info"    && "bg-blue-500",
          variant === "brand"   && "bg-[#408A71]",
          variant === "default" && "bg-gray-400",
        )} />
      )}
      {children}
    </span>
  );
}
