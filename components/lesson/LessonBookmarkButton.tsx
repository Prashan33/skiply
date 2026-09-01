"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import posthog from "posthog-js";

/**
 * Toggles a lesson bookmark through `POST /api/bookmarks` (the only write path —
 * the browser never touches the dataset). Optimistic: the icon flips
 * immediately and reverts if the write fails. On success it refreshes so the
 * server-rendered My Learning list and initial state stay in sync.
 */
export function LessonBookmarkButton({
  lessonId,
  lessonSlug,
  lessonTitle,
  initialBookmarked,
}: {
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
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
      body: JSON.stringify({ kind: "lesson", refId: lessonId, bookmarked: next }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("bookmark failed");
        if (next) {
          posthog.capture("lesson_bookmarked", {
            lesson_slug: lessonSlug,
            lesson_title: lessonTitle,
          });
        }
        startTransition(() => router.refresh());
      })
      .catch(() => {
        setBookmarked(!next);
      });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? "Remove bookmark" : "Save lesson"}
      title={bookmarked ? "Remove bookmark" : "Save lesson"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 disabled:opacity-60"
    >
      <Bookmark
        className={`h-4 w-4 ${bookmarked ? "fill-current text-neutral-700" : ""}`}
        strokeWidth={2}
      />
    </button>
  );
}
