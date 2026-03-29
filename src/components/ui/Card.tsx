import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export default function Card({ hover = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm",
        hover && "hover:shadow-md transition-shadow",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 py-4 border-b border-gray-50 dark:border-gray-700", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  );
}
