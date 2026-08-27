import { type InputHTMLAttributes, forwardRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: boolean;
  shortcut?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, shortcut, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
            strokeWidth={2}
          />
        )}
        <input
          ref={ref}
          className={cn(
            "h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-4 text-body text-neutral-900 placeholder:text-neutral-500 focus:border-primary-400 focus:outline-none",
            icon && "pl-10",
            shortcut && "pr-14",
            className,
          )}
          {...props}
        />
        {shortcut && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded border border-neutral-200 px-1.5 py-0.5 text-small text-neutral-500">
            {shortcut}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
