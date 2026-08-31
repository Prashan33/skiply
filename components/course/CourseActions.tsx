"use client";

import Link from "next/link";
import { ArrowRight, Bookmark } from "lucide-react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/Button";

export function CourseActions({
  continueHref,
  courseSlug,
  courseTitle,
}: {
  continueHref: string;
  courseSlug: string;
  courseTitle: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={continueHref}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-primary-500 px-4 text-body font-medium text-white transition-colors hover:bg-primary-400"
      >
        Continue Learning
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </Link>
      <Button
        variant="tertiary"
        type="button"
        onClick={() =>
          posthog.capture("course_bookmarked", {
            course_slug: courseSlug,
            course_title: courseTitle,
          })
        }
      >
        <Bookmark className="h-4 w-4" strokeWidth={2} />
        Bookmark
      </Button>
    </div>
  );
}
