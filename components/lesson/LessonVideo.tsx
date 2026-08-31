"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import posthog from "posthog-js";
import { embedSrc, parseVideoUrl } from "@/lib/video";

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

/* Minimal YouTube IFrame Player API surface we rely on. */
type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement | string,
    opts: {
      events?: {
        onStateChange?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
  return apiPromise;
}

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
  const frameRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const firedRef = useRef<{ played: boolean; milestones: Set<number>; completed: boolean }>({
    played: false,
    milestones: new Set(),
    completed: false,
  });

  useEffect(() => {
    if (parsed?.provider !== "youtube") return;
    const frame = frameRef.current;
    if (!frame) return;

    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const track = () => {
      const player = playerRef.current;
      if (!player) return;
      const duration = player.getDuration();
      const current = player.getCurrentTime();
      if (!duration || !Number.isFinite(duration)) return;
      const percent = Math.floor((current / duration) * 100);
      const fired = firedRef.current;
      for (const milestone of [25, 50, 75]) {
        if (percent >= milestone && !fired.milestones.has(milestone)) {
          fired.milestones.add(milestone);
          posthog.capture("video_progress", { lesson_slug: lessonSlug, percent: milestone });
        }
      }
      if (percent >= 95 && !fired.completed) {
        fired.completed = true;
        posthog.capture("lesson_completed", {
          lesson_slug: lessonSlug,
          course_slug: courseSlug,
        });
      }
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !frameRef.current) return;
        playerRef.current = new YT.Player(frameRef.current, {
          events: {
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING) {
                if (!firedRef.current.played) {
                  firedRef.current.played = true;
                  posthog.capture("video_played", {
                    lesson_slug: lessonSlug,
                    lesson_title: title,
                    course_slug: courseSlug,
                    provider: "youtube",
                    start_seconds: startSeconds,
                  });
                }
                if (!interval) interval = setInterval(track, 5000);
              }
            },
          },
        });
      })
      .catch(() => {
        /* API blocked — embed still plays, just no analytics. */
      });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      try {
        playerRef.current?.destroy();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
  }, [parsed?.provider, lessonSlug, courseSlug, title, startSeconds]);

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
