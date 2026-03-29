import { cn } from "@/lib/utils";

const variants = {
  default: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
  success: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
  warning: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400",
  danger: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
  info: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  brand: "bg-[#B0E4CC]/20 dark:bg-[#285A48]/30 text-[#285A48] dark:text-[#B0E4CC]",
} as const;

type Variant = keyof typeof variants;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  dot?: boolean;
}

export default function Badge({ variant = "default", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          variant === "success" && "bg-green-500",
          variant === "warning" && "bg-yellow-500",
          variant === "danger" && "bg-red-500",
          variant === "info" && "bg-blue-500",
          variant === "brand" && "bg-[#408A71]",
          variant === "default" && "bg-gray-400",
        )} />
      )}
      {children}
    </span>
  );
}
