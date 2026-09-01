"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Play } from "lucide-react";
import posthog from "posthog-js";
import { cn } from "@/lib/cn";
import { ProgressBar } from "@/components/ui/ProgressBar";

export type SidebarLesson = {
  id: string;
  title: string;
  slug: string | null;
  clock: string;
  status: "done" | "active" | "upcoming";
};

export type SidebarModule = {
  key: string;
  title: string;
  durationLabel: string;
  lessons: SidebarLesson[];
  /** Every lesson in the module is completed in the learner's progress record. */
  completed: boolean;
  hasActive: boolean;
};

/**
 * Presentational course outline for the lesson page. `status`, `completed`, and
 * `percentComplete` are computed by the page from the learner's real progress
 * record (watch-gated via `POST /api/progress`, AGENTS.md §7).
 */
export function LessonSidebar({
  courseTitle,
  courseSlug,
  monogram,
  percentComplete,
  activeModuleLabel,
  modules,
}: {
  courseTitle: string;
  courseSlug: string | null;
  monogram: string;
  percentComplete: number;
  activeModuleLabel: string;
  modules: SidebarModule[];
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(modules.map((m) => [m.key, m.hasActive])),
  );

  const backHref = courseSlug ? `/courses/${courseSlug}` : "/courses";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-body font-medium text-primary-500 hover:text-primary-400"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to course
      </Link>

      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-neutral-900 font-display text-heading-2 font-bold text-white"
        >
          {monogram}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-neutral-900">{courseTitle}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <ProgressBar value={percentComplete} showLabel={false} className="flex-1" />
            <span className="whitespace-nowrap text-small text-neutral-500">
              {percentComplete}% complete
            </span>
          </div>
        </div>
      </div>

      <p className="border-t border-neutral-200 pt-4 text-small font-semibold tracking-wide text-neutral-500 uppercase">
        {activeModuleLabel}
      </p>

      <ul className="flex flex-col">
        {modules.map((module, index) => {
          const isOpen = Boolean(open[module.key]);
          return (
            <li key={module.key} className="border-b border-neutral-100 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpen((prev) => ({ ...prev, [module.key]: !prev[module.key] }))}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-small font-medium",
                    module.completed
                      ? "border-primary-500 bg-primary-500 text-white"
                      : module.hasActive
                        ? "border-primary-500 text-primary-500"
                        : "border-neutral-300 text-neutral-500",
                  )}
                >
                  {module.completed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-neutral-900">
                    {module.title}
                  </span>
                  <span className="text-small text-neutral-500">{module.durationLabel}</span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-neutral-400 transition-transform",
                    isOpen && "rotate-180",
                  )}
                  strokeWidth={2}
                />
              </button>

              {isOpen && module.lessons.length > 0 && (
                <ul className="mb-2 flex flex-col gap-1 pl-9">
                  {module.lessons.map((lesson) => {
                    const inner = (
                      <span className="flex items-center gap-3 py-1.5">
                        {lesson.status === "active" ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
                            <Play className="h-3 w-3 fill-current" strokeWidth={0} />
                          </span>
                        ) : lesson.status === "done" ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary-500 text-primary-500">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="h-5 w-5 shrink-0 rounded-full border border-neutral-300" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-body",
                              lesson.status === "active"
                                ? "font-medium text-primary-500"
                                : "text-neutral-700",
                            )}
                          >
                            {lesson.title}
                          </span>
                          <span className="text-small text-neutral-500">
                            {lesson.status === "active" ? "Now playing" : lesson.clock}
                          </span>
                        </span>
                      </span>
                    );

                    if (lesson.status === "active" || !lesson.slug) {
                      return (
                        <li key={lesson.id} aria-current="true">
                          {inner}
                        </li>
                      );
                    }
                    return (
                      <li key={lesson.id}>
                        <Link
                          href={`/lessons/${lesson.slug}`}
                          onClick={() =>
                            posthog.capture("lesson_nav_clicked", {
                              lesson_title: lesson.title,
                              module_title: module.title,
                            })
                          }
                          className="block rounded-[var(--radius-xs)] hover:bg-neutral-50"
                        >
                          {inner}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
