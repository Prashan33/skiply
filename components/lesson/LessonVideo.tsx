"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  /** Analytics + progress context. */
  lessonSlug: string;
  courseSlug: string | null;
  lessonId: string;
  /** Seeded from the learner's stored progress (AGENTS.md §7). */
  initialSecondsWatched: number;
  initialCompleted: boolean;
};

/** Watch-depth milestones (%). Crossing 95 also fires the analytics event. */
const MILESTONES = [25, 50, 75, 95] as const;
const COMPLETE_AT = 95;
/** Persist to `/api/progress` once this many new unique seconds have accrued. */
const PERSIST_EVERY_SECONDS = 15;
/** A forward jump larger than this is a seek, not playback — don't count the gap. */
const MAX_PLAYBACK_STEP = 12;

export function LessonVideo({
  videoUrl,
  startSeconds,
  title,
  poster,
  monogram,
  lessonSlug,
  courseSlug,
  lessonId,
  initialSecondsWatched,
  initialCompleted,
}: Props) {
  const parsed = parseVideoUrl(videoUrl);
  const provider = parsed?.provider ?? null;
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Captured once. `router.refresh()` (fired on completion) re-renders this
  // component with a larger `initialSecondsWatched`; if the effect re-ran off
  // that, `baseline + sessionUnique` would double-count. The server keeps
  // `secondsWatched` monotonic, so a stable baseline is always safe.
  const baselineSeconds = useRef(initialSecondsWatched);
  const fired = useRef({
    played: false,
    milestones: new Set<number>(),
    completed: false,
    maxPercent: 0,
    furthestSeconds: 0,
    // Progress persistence.
    watched: new Set<number>(),
    lastTickSeconds: -1,
    lastSentUnique: 0,
    lastPosition: 0,
    progressCompleted: initialCompleted,
  });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !provider) return;

    // Stable for the life of the effect — `fired` is a ref that is never reassigned.
    const state = fired.current;

    const persist = (keepalive: boolean) => {
      const unique = state.watched.size;
      state.lastSentUnique = unique;
      const payload = JSON.stringify({
        lessonId,
        secondsWatched: baselineSeconds.current + unique,
        lastPosition: Math.round(state.lastPosition),
      });
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { completed?: boolean } | null) => {
          if (data?.completed && !state.progressCompleted) {
            state.progressCompleted = true;
            // Server-rendered sidebar / progress bar re-read the record.
            router.refresh();
          }
        })
        .catch(() => {
          /* Progress is best-effort — never disrupt playback. */
        });
    };

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
        state.lastPosition = currentSeconds;

        // Count unique seconds of *contiguous* playback only.
        const prevTick = state.lastTickSeconds;
        const now = Math.floor(currentSeconds);
        if (prevTick >= 0 && currentSeconds - prevTick > 0 && currentSeconds - prevTick <= MAX_PLAYBACK_STEP) {
          for (let s = Math.floor(prevTick); s <= now; s++) state.watched.add(s);
        } else {
          state.watched.add(now);
        }
        state.lastTickSeconds = currentSeconds;

        if (state.watched.size - state.lastSentUnique >= PERSIST_EVERY_SECONDS) {
          persist(false);
        }

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
      if (state.watched.size > state.lastSentUnique || state.lastPosition > 0) {
        persist(true);
      }
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
  }, [provider, lessonSlug, courseSlug, title, startSeconds, lessonId, router]);

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
