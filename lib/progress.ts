/**
 * Shared, pure helpers for watch-gated lesson completion (AGENTS.md §7).
 *
 * A lesson completes once the learner has watched enough *unique* seconds of its
 * video: 7 minutes (420s) by default, or 90% of the runtime for videos shorter
 * than that. `PROGRESS_COMPLETE_SECONDS` (server-only) overrides the 420s floor
 * for QA. This module has no server-only imports so the client can share it.
 */

export const DEFAULT_COMPLETE_SECONDS = 420;

/** Seconds of unique playback required to complete a lesson of `durationSeconds`. */
export function completionThresholdSeconds(
  durationSeconds: number | null | undefined,
  overrideSeconds?: number | null,
): number {
  const floor =
    typeof overrideSeconds === "number" && overrideSeconds > 0
      ? overrideSeconds
      : DEFAULT_COMPLETE_SECONDS;
  if (typeof durationSeconds === "number" && durationSeconds > 0 && durationSeconds < floor) {
    return Math.floor(durationSeconds * 0.9);
  }
  return floor;
}

export function clampSeconds(value: number, maxSeconds: number | null | undefined): number {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const lo = Math.max(0, rounded);
  if (typeof maxSeconds === "number" && maxSeconds > 0) return Math.min(lo, maxSeconds);
  return lo;
}

export type ProgressEntry = {
  lessonId: string;
  secondsWatched: number;
  completed: boolean;
  lastPosition: number;
};
