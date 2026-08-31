import { type ReactNode } from "react";
import Image from "next/image";
import { BarChart3, Clock, ExternalLink, FileText, PlayCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "./Badge";

export function CourseCard({
  icon,
  iconClassName,
  image,
  title,
  description,
  level,
  duration,
  modules,
  className,
}: {
  icon?: ReactNode;
  iconClassName?: string;
  image?: { url: string; alt: string };
  title: string;
  description: string;
  level: string;
  duration: string;
  modules: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-md)] border border-neutral-200 bg-white shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {image ? (
        <div className="relative aspect-video w-full bg-neutral-100">
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="p-5">
        {icon ? (
          <div
            className={cn(
              "mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-neutral-900 text-white",
              iconClassName,
            )}
          >
            {icon}
          </div>
        ) : null}
        <h3 className="mb-1 text-heading-3 font-medium text-neutral-900">
          {title}
        </h3>
        <p className="mb-4 text-body text-neutral-500">{description}</p>
        <div className="flex items-center gap-4 text-small text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" strokeWidth={2} />
            {level}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            {duration}
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" strokeWidth={2} />
            {modules}
          </span>
        </div>
      </div>
    </div>
  );
}

export function LessonCard({
  badgeVariant,
  badgeLabel,
  title,
  description,
  meta,
  actionLabel,
  className,
}: {
  badgeVariant: "video" | "lesson";
  badgeLabel: string;
  title: string;
  description: string;
  meta: string;
  actionLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-neutral-200 bg-white p-5 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <Badge variant={badgeVariant} className="mb-3">
        {badgeLabel}
      </Badge>
      <h3 className="mb-1 text-heading-3 font-medium text-neutral-900">
        {title}
      </h3>
      <p className="mb-4 text-body text-neutral-500">{description}</p>
      <div className="flex items-center justify-between">
        <span className="text-small text-neutral-500">{meta}</span>
        <button className="inline-flex items-center gap-1 text-body font-medium text-primary-500">
          {actionLabel}
          <PlayCircle className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export function ResourceCard({
  title,
  description,
  meta,
  className,
}: {
  title: string;
  description: string;
  meta: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-neutral-200 bg-white p-5 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-neutral-100 text-neutral-700">
        <FileText className="h-5 w-5" strokeWidth={2} />
      </div>
      <h3 className="mb-1 text-heading-3 font-medium text-neutral-900">
        {title}
      </h3>
      <p className="mb-4 text-body text-neutral-500">{description}</p>
      <span className="inline-flex items-center gap-1 text-small text-neutral-500">
        {meta}
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    </div>
  );
}
