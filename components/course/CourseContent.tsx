"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import posthog from "posthog-js";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

export type CourseContentLesson = {
  id: string;
  label: string;
  title: string;
  slug: string | null;
  clock: string;
  freePreview: boolean;
  completed: boolean;
};

export type CourseContentModule = {
  key: string;
  title: string;
  summary: string | null;
  durationLabel: string;
  lessons: CourseContentLesson[];
};

const INITIAL_VISIBLE = 6;

export function CourseContent({
  modules,
  totalDurationLabel,
}: {
  modules: CourseContentModule[];
  totalDurationLabel: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const canToggle = modules.length > INITIAL_VISIBLE;
  const visible = showAll ? modules : modules.slice(0, INITIAL_VISIBLE);

  return (
    <section className="pt-14">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="font-display text-heading-1 text-neutral-900">
          Course Content
        </h2>
        <span className="whitespace-nowrap text-body text-neutral-500">
          {modules.length} modules &nbsp;&middot;&nbsp; {totalDurationLabel}
        </span>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-neutral-200 bg-white shadow-[var(--shadow-sm)]">
        {visible.map((module, index) => {
          const isOpen = Boolean(expanded[module.key]);
          return (
            <div
              key={module.key}
              className={cn(index > 0 && "border-t border-neutral-200")}
            >
              <button
                type="button"
                onClick={() => {
                  const opening = !expanded[module.key];
                  setExpanded((prev) => ({
                    ...prev,
                    [module.key]: !prev[module.key],
                  }));
                  if (opening) {
                    posthog.capture("module_expanded", {
                      module_title: module.title,
                      lesson_count: module.lessons.length,
                    });
                  }
                }}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-neutral-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-small font-medium text-neutral-500">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-neutral-900">
                    {module.title}
                  </span>
                  {module.summary && (
                    <span className="mt-0.5 block truncate text-small text-neutral-500">
                      {module.summary}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap text-small text-neutral-500">
                  {module.durationLabel}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-neutral-500 transition-transform",
                    isOpen && "rotate-180",
                  )}
                  strokeWidth={2}
                />
              </button>

              {isOpen && module.lessons.length > 0 && (
                <ul className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-2">
                  {module.lessons.map((lesson) => {
                    const row = (
                      <span className="flex items-center gap-3 py-2.5">
                        <span className="flex w-12 shrink-0 items-center text-small text-neutral-500">
                          {lesson.completed ? (
                            <span
                              aria-label="Completed"
                              className="flex h-5 w-5 items-center justify-center rounded-full border border-primary-500 text-primary-500"
                            >
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                          ) : (
                            lesson.label
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-body text-neutral-700">
                          {lesson.title}
                        </span>
                        {lesson.freePreview && (
                          <Badge variant="lesson">Free</Badge>
                        )}
                        <span className="whitespace-nowrap text-small text-neutral-500">
                          {lesson.clock}
                        </span>
                      </span>
                    );
                    return (
                      <li
                        key={lesson.id}
                        className="border-b border-neutral-200/70 last:border-b-0"
                      >
                        {lesson.slug ? (
                          <Link
                            href={`/lessons/${lesson.slug}`}
                            className="block rounded-[var(--radius-xs)] hover:text-neutral-900"
                            onClick={() =>
                              posthog.capture("lesson_clicked", {
                                lesson_title: lesson.title,
                                lesson_label: lesson.label,
                                module_title: module.title,
                              })
                            }
                          >
                            {row}
                          </Link>
                        ) : (
                          row
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {canToggle && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-neutral-200 bg-white px-4 py-2.5 text-body font-medium text-neutral-700 hover:border-neutral-300"
          >
            {showAll ? "Show less" : `Show all ${modules.length} modules`}
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")}
              strokeWidth={2}
            />
          </button>
        </div>
      )}
    </section>
  );
}
