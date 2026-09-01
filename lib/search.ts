/**
 * Shared contract for the search feature. Pure — no `server-only`, no secrets —
 * so it can be imported by both the API route (server) and the results UI
 * (client).
 *
 * AGENTS.md §7 / §11: search returns grounded *result cards*, not prose. The
 * model only decides the framing (`kind`), a short `description`, an optional
 * `startSeconds`, and its own `relevance` score. Everything shown on a card
 * (course, "Lesson N.M", module title, key points, thumbnail, duration) is
 * derived on the server from Sanity and keyed by `lessonSlug`, so labels and
 * counts can never be hallucinated.
 */

import { z } from "zod";

export const searchResultSchema = z.object({
  /**
   * "video" when the lesson's value is mainly the video walkthrough/demo,
   * "lesson" when it's conceptual. Both link to the lesson page. This is a
   * heuristic until the transcript/chapter ingestion pipeline (AGENTS §9) lands.
   */
  kind: z.enum(["video", "lesson"]),
  /** `slug.current` of a lesson that appeared in the model's GROQ results. */
  lessonSlug: z.string().min(1),
  /**
   * One or two plain sentences, grounded only in that lesson's own
   * title/notes/keyPoints. No markdown.
   */
  description: z.string().max(240),
  /**
   * Second to start playback from. Always 0 for now — `video.chapters` /
   * `video.chunks` are empty and there is no ingestion pipeline yet.
   * No `.default()`: OpenAI strict structured output requires every property in
   * `required`. The model is told to send 0; the client also coerces it.
   */
  startSeconds: z.number().int().min(0),
  /** The model's own ranking score, 0–1, higher = better. Used as the tiebreak for the default sort. */
  relevance: z.number().min(0).max(1),
});

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
});

export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

/** Per-lesson display data the results page derives from Sanity (see `app/search/page.tsx`). */
export type SearchIndexLesson = {
  lessonSlug: string;
  lessonTitle: string;
  /** "Lesson 5.1" — derived from module/lesson order, not stored (AGENTS §8). */
  lessonLabel: string;
  /** "Module 5" — derived from module order. */
  moduleLabel: string;
  moduleTitle: string;
  courseTitle: string;
  courseSlug: string;
  /** First letter of the course title, for the monogram tile (no brand icons available). */
  courseMonogram: string;
  keyPoints: string[];
  /** "12:45" */
  durationClock: string;
  /** Resolved Sanity image URL, or null. */
  posterUrl: string | null;
};

export type SearchIndex = Record<string, SearchIndexLesson>;

/** A model result merged with its grounded display data. */
export type GroundedResult = SearchResult & SearchIndexLesson;

export const SEARCH_QUERY_MAX_LENGTH = 200;

/**
 * Join the model's raw results against the Sanity-derived index, dropping any
 * slug not in the index (hallucinated or stale) and de-duplicating. Shared by
 * the results list and the `search_results_returned` analytics event so both see
 * the same grounded set.
 */
export function groundResults(
  results: ReadonlyArray<Partial<SearchResult> | undefined> | undefined,
  index: SearchIndex,
): GroundedResult[] {
  const out: GroundedResult[] = [];
  const seen = new Set<string>();
  for (const item of results ?? []) {
    const slug = item?.lessonSlug;
    if (!slug || seen.has(slug)) continue;
    const entry = index[slug];
    if (!entry) continue;
    seen.add(slug);
    out.push({
      ...entry,
      kind: item?.kind === "video" ? "video" : "lesson",
      lessonSlug: slug,
      description: typeof item?.description === "string" ? item.description : "",
      startSeconds:
        typeof item?.startSeconds === "number" && item.startSeconds > 0
          ? Math.floor(item.startSeconds)
          : 0,
      relevance: typeof item?.relevance === "number" ? item.relevance : 0,
    });
  }
  return out;
}
