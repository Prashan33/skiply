import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeVariant =
  | "video"
  | "lesson"
  | "popular"
  | "neutral"
  | "videoTag"
  | "lessonTag";

const variantClasses: Record<BadgeVariant, string> = {
  video: "bg-neutral-900 text-white",
  lesson: "bg-primary-100 text-primary-500",
  popular: "bg-primary-500 text-white",
  neutral: "bg-neutral-100 text-neutral-700",
  // Search result kinds (design/search.png).
  videoTag: "bg-primary-100 text-primary-500",
  lessonTag: "bg-accent-100 text-accent-600",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] px-2 py-0.5 text-small font-semibold uppercase tracking-wide",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
