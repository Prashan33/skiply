import { cn } from "@/lib/cn";

export function Logo({
  className,
  wordmark = true,
}: {
  className?: string;
  wordmark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-primary-500 font-display text-base font-bold text-white">
        S
      </span>
      {wordmark && (
        <span className="font-display text-xl font-bold text-neutral-900">
          Skiply
        </span>
      )}
    </div>
  );
}
