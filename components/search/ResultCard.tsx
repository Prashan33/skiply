"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Check,
  ChevronRight,
  ExternalLink,
  FileText,
  Folder,
  PlayCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { formatClock } from "@/lib/format";
import type { GroundedResult } from "@/lib/search";

function CourseRow({
  monogram,
  courseTitle,
  kind,
}: {
  monogram: string;
  courseTitle: string;
  kind: "video" | "lesson";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border border-neutral-200 bg-white text-[11px] font-semibold text-neutral-900">
          {monogram}
        </span>
        <span className="truncate text-small text-neutral-500">{courseTitle}</span>
      </span>
      <Badge variant={kind === "video" ? "videoTag" : "lessonTag"} className="shrink-0">
        {kind === "video" ? "Video" : "Lesson"}
      </Badge>
    </div>
  );
}

export function ResultCard({
  result,
  onSelect,
}: {
  result: GroundedResult;
  onSelect?: () => void;
}) {
  const start = result.startSeconds > 0 ? result.startSeconds : 0;
  const href = start > 0
    ? `/lessons/${result.lessonSlug}?t=${start}&ref=search`
    : `/lessons/${result.lessonSlug}`;

  const isVideo = result.kind === "video";

  return (
    <Link
      href={href}
      onClick={onSelect}
      className="group flex flex-col gap-5 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-5 shadow-[var(--shadow-sm)] transition-colors hover:border-neutral-300 sm:flex-row"
    >
      {isVideo ? (
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-neutral-900 sm:w-64">
          {result.posterUrl ? (
            <Image
              src={result.posterUrl}
              alt=""
              fill
              sizes="(min-width: 640px) 240px, 100vw"
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center font-display text-5xl text-white/80">
              {result.courseMonogram}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <PlayCircle
              className="h-10 w-10 text-white drop-shadow"
              strokeWidth={1.5}
            />
          </span>
          <span className="absolute bottom-2 right-2 rounded-[var(--radius-xs)] bg-neutral-900/85 px-1.5 py-0.5 text-small font-medium text-white">
            {result.durationClock}
          </span>
        </div>
      ) : (
        <div className="relative w-full shrink-0 rounded-[var(--radius-sm)] border border-neutral-200 bg-neutral-50 p-4 sm:w-64">
          <ul className="space-y-1.5">
            {result.keyPoints.length > 0 ? (
              result.keyPoints.map((point, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-small text-neutral-700"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300" />
                  <span className="line-clamp-1">{point}</span>
                </li>
              ))
            ) : (
              <li className="text-small text-neutral-500">Lesson notes</li>
            )}
          </ul>
          {/* Presentational only — per-learner progress has no backend yet
              (same convention as CourseProgressBar / LessonSidebar). */}
          <span className="absolute bottom-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900">
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <CourseRow
          monogram={result.courseMonogram}
          courseTitle={result.courseTitle}
          kind={result.kind}
        />

        <h3 className="text-heading-3 font-medium text-neutral-900">
          {result.lessonTitle}
        </h3>

        {result.description ? (
          <p className="line-clamp-2 text-body text-neutral-500">
            {result.description}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
          {isVideo ? (
            <span className="inline-flex items-center gap-x-3 text-small text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                {result.lessonLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5" strokeWidth={2} />
                {result.moduleTitle}
              </span>
            </span>
          ) : (
            <span className="text-small text-neutral-500">{result.moduleLabel}</span>
          )}

          <span className="inline-flex items-center gap-1 text-body font-medium text-primary-500">
            {isVideo
              ? start > 0
                ? `Watch from ${formatClock(start)}`
                : "Watch lesson"
              : "View lesson"}
            {isVideo ? (
              <PlayCircle className="h-4 w-4" strokeWidth={2} />
            ) : (
              <ExternalLink className="h-4 w-4" strokeWidth={2} />
            )}
            <ChevronRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
