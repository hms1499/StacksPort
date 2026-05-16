import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, style, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-xl border text-sm transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-[#408A71] focus:border-transparent",
              icon ? "pl-9 pr-4 py-2.5" : "px-4 py-2.5",
              error && "border-red-300 focus:ring-red-500",
              className
            )}
            style={{
              borderColor: error ? undefined : 'var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              ...style,
            }}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
