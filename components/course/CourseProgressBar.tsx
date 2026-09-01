"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import posthog from "posthog-js";
import { Container } from "@/components/ui/Container";
import { ProgressBar } from "@/components/ui/ProgressBar";

/**
 * The sticky "Your Progress" bar. `percent` is the learner's real completion for
 * this course, computed on the server from their progress record (watch-gated,
 * AGENTS.md §7). Signed-out visitors see 0%.
 */
export function CourseProgressBar({
  continueHref,
  percent,
}: {
  continueHref: string;
  percent: number;
}) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white shadow-[var(--shadow-lg)] print:hidden">
      <Container className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="shrink-0">
          <p className="text-small text-neutral-500">Your Progress</p>
          <p className="text-body font-semibold text-neutral-900">
            {percent}% complete
          </p>
        </div>
        <ProgressBar value={percent} showLabel={false} className="flex-1" />
        <Link
          href={continueHref}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-primary-500 px-4 text-body font-medium text-white transition-colors hover:bg-primary-400"
          onClick={() => posthog.capture("course_started")}
        >
          Continue Learning
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </Container>
    </div>
  );
}
