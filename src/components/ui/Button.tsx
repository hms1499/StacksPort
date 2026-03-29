"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variantStyles = {
  primary:
    "bg-[#408A71] hover:bg-[#285A48] text-white shadow-sm",
  secondary:
    "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm",
  ghost:
    "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
  danger:
    "bg-red-500 hover:bg-red-600 text-white shadow-sm",
} as const;

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-xl gap-2",
  lg: "px-5 py-2.5 text-sm rounded-xl gap-2.5",
} as const;

type Variant = keyof typeof variantStyles;
type Size = keyof typeof sizeStyles;

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, icon, children, className, disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
        {children as React.ReactNode}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
export default Button;
