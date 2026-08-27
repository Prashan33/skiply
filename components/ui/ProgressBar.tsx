import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  showLabel = true,
  className,
}: {
  value: number;
  showLabel?: boolean;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-primary-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="whitespace-nowrap text-small text-neutral-500">
          {clamped}% complete
        </span>
      )}
    </div>
  );
}
