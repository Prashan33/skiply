"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark } from "lucide-react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/Button";

export function CourseActions({
  continueHref,
  courseId,
  courseSlug,
  courseTitle,
  initialBookmarked,
}: {
  continueHref: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  initialBookmarked: boolean;
}) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !bookmarked;
    setBookmarked(next);

    fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "course", refId: courseId, bookmarked: next }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("bookmark failed");
        if (next) {
          posthog.capture("course_bookmarked", {
            course_slug: courseSlug,
            course_title: courseTitle,
          });
        }
        startTransition(() => router.refresh());
      })
      .catch(() => {
        setBookmarked(!next);
      });
  };

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
        onClick={toggle}
        disabled={pending}
        aria-pressed={bookmarked}
      >
        <Bookmark
          className={`h-4 w-4 ${bookmarked ? "fill-current" : ""}`}
          strokeWidth={2}
        />
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </Button>
    </div>
  );
}
