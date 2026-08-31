"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import posthog from "posthog-js";
import { Container } from "@/components/ui/Container";

export type NavLesson = { title: string; slug: string | null; clock: string };

export function LessonNav({
  previous,
  next,
}: {
  previous: NavLesson | null;
  next: NavLesson | null;
}) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white shadow-[var(--shadow-lg)] print:hidden">
      <Container className="flex items-center justify-between gap-4 py-4">
        {previous?.slug ? (
          <Link
            href={`/lessons/${previous.slug}`}
            onClick={() => posthog.capture("lesson_nav_clicked", { direction: "previous" })}
            className="inline-flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-200 px-4 py-2.5 text-left hover:border-neutral-300"
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={2} />
            <span className="hidden sm:block">
              <span className="block text-small text-neutral-500">Previous Lesson</span>
              <span className="block max-w-[16rem] truncate text-body font-medium text-neutral-900">
                {previous.title}
              </span>
            </span>
            <span className="text-body font-medium text-neutral-900 sm:hidden">Previous</span>
          </Link>
        ) : (
          <span />
        )}

        {next?.slug ? (
          <Link
            href={`/lessons/${next.slug}`}
            onClick={() => posthog.capture("lesson_nav_clicked", { direction: "next" })}
            className="inline-flex items-center gap-3"
          >
            <span className="hidden text-right sm:block">
              <span className="block text-small text-neutral-500">Next Lesson</span>
              <span className="block max-w-[16rem] truncate text-body font-medium text-neutral-900">
                {next.title}
              </span>
            </span>
            <span className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-primary-500 px-4 text-body font-medium text-white transition-colors hover:bg-primary-400">
              Next Lesson
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </span>
          </Link>
        ) : (
          <span />
        )}
      </Container>
    </div>
  );
}
