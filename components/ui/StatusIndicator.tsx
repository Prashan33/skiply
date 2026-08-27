import { Circle, CheckCircle2, PlayCircle, Lock } from "lucide-react";
import { cn } from "@/lib/cn";

type Status = "in-progress" | "completed" | "now-playing" | "locked";

const config: Record<
  Status,
  { icon: typeof Circle; label: string; className: string }
> = {
  "in-progress": {
    icon: Circle,
    label: "In Progress",
    className: "text-neutral-500",
  },
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    className: "text-primary-500",
  },
  "now-playing": {
    icon: PlayCircle,
    label: "Now Playing",
    className: "text-primary-500",
  },
  locked: {
    icon: Lock,
    label: "Locked",
    className: "text-neutral-500",
  },
};

export function StatusIndicator({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const { icon: Icon, label, className: colorClass } = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-body text-neutral-700",
        className,
      )}
    >
      <Icon className={cn("h-4 w-4", colorClass)} strokeWidth={2} />
      {label}
    </span>
  );
}
