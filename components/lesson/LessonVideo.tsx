"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import posthog from "posthog-js";
import { embedSrc, parseVideoUrl } from "@/lib/video";
import { attachVideoTracker } from "@/lib/video-tracking";

type Props = {
  videoUrl: string | null;
  startSeconds: number;
  title: string;
  poster?: { url: string; alt: string } | null;
  monogram: string;
  /** Analytics context. */
  lessonSlug: string;
  courseSlug: string | null;
};

/** Watch-depth milestones (%). Crossing 95 also marks the lesson completed. */
const MILESTONES = [25, 50, 75, 95] as const;
const COMPLETE_AT = 95;

export function LessonVideo({
  videoUrl,
  startSeconds,
  title,
  poster,
  monogram,
  lessonSlug,
  courseSlug,
}: Props) {
  const parsed = parseVideoUrl(videoUrl);
  const provider = parsed?.provider ?? null;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fired = useRef({
    played: false,
    milestones: new Set<number>(),
    completed: false,
    maxPercent: 0,
    furthestSeconds: 0,
  });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !provider) return;

    // Stable for the life of the effect — `fired` is a ref that is never reassigned.
    const state = fired.current;

    const cleanup = attachVideoTracker(frame, provider, {
      onPlay: () => {
        if (state.played) return;
        state.played = true;
        posthog.capture("video_played", {
          lesson_slug: lessonSlug,
          lesson_title: title,
          course_slug: courseSlug,
          provider,
          start_seconds: startSeconds,
        });
      },
      onProgress: ({ percent, currentSeconds }) => {
        if (percent > state.maxPercent) state.maxPercent = percent;
        if (currentSeconds > state.furthestSeconds) state.furthestSeconds = currentSeconds;

        for (const milestone of MILESTONES) {
          if (percent >= milestone && !state.milestones.has(milestone)) {
            state.milestones.add(milestone);
            posthog.capture("video_watched", {
              lesson_slug: lessonSlug,
              course_slug: courseSlug,
              provider,
              percent: milestone,
            });
          }
        }

        if (percent >= COMPLETE_AT && !state.completed) {
          state.completed = true;
          posthog.capture("lesson_completed", {
            lesson_slug: lessonSlug,
            course_slug: courseSlug,
            completion_trigger: "video",
            percent,
          });
        }
      },
    });

    return () => {
      cleanup();
      if (state.played) {
        posthog.capture("video_watch_depth", {
          lesson_slug: lessonSlug,
          course_slug: courseSlug,
          provider,
          percent: state.maxPercent,
          seconds_watched: Math.round(state.furthestSeconds),
        });
      }
    };
  }, [provider, lessonSlug, courseSlug, title, startSeconds]);

  if (!parsed) {
    return (
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[var(--radius-lg)] bg-neutral-900 text-white">
        {poster?.url ? (
          <Image src={poster.url} alt={poster.alt || title} fill className="object-cover opacity-60" sizes="(min-width: 1024px) 720px, 100vw" />
        ) : (
          <span aria-hidden className="font-display text-[6rem] leading-none font-bold text-white/90">
            {monogram}
          </span>
        )}
        <span className="absolute bottom-4 left-4 rounded-[var(--radius-xs)] bg-black/60 px-2 py-1 text-small">
          Video unavailable
        </span>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] bg-neutral-900 shadow-[var(--shadow-md)]">
      <iframe
        ref={frameRef}
        src={embedSrc(parsed, startSeconds)}
        title={title}
        loading="lazy"
        allow="accelerated-display; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}
