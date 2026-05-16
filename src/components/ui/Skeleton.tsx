import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Variant shape */
  variant?: "text" | "circle" | "rect";
  /** Width in tailwind units or px */
  width?: string;
  /** Height in tailwind units or px */
  height?: string;
}

export default function Skeleton({
  variant = "text",
  width,
  height,
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse",
        variant === "circle" && "rounded-full",
        variant === "text" && "rounded h-3",
        variant === "rect" && "rounded-xl",
        className
      )}
      style={{ width, height, backgroundColor: 'var(--border-subtle)' }}
      {...props}
    />
  );
}
