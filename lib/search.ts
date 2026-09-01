/**
 * Shared contract for the search feature. Pure — no `server-only`, no secrets —
 * so it can be imported by both the API route (server) and the results UI
 * (client).
 *
 * AGENTS.md §7 / §11: search returns grounded *result cards*, not prose. The
 * model only decides the framing (`kind`), a short `description`, a copied
 * `startSeconds`, and its own `relevance` score. Everything shown on a card
 * (course, "Lesson N.M", module title, key points, thumbnail, duration) is
 * derived on the server from Sanity and keyed by `lessonSlug`, so labels and
 * counts can never be hallucinated.
 *
 * `startSeconds` is resolved on the server *before* the model runs (see
 * `resolveVideoMoments` in `app/api/search/route.ts`): the query keywords are
 * matched against the matched lesson's linked `video` document — chapters first
 * (`chapters[].label`), transcript only as a fallback (`chunks[].text`). The
 * model is handed the resolved integer and told to copy it verbatim; it never
 * invents one.
 */

import { z } from "zod";

export const searchResultSchema = z.object({
  /**
   * "video" when the server resolved a start moment for this lesson's video
   * (chapters-first, transcript-fallback), or when the lesson's value is mainly
   * a walkthrough/demo. "lesson" when it's conceptual. Both link to the lesson
   * page.
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
   * Second to start playback from. Resolved on the server against the lesson's
   * linked `video` doc and handed to the model to copy verbatim; `0` when no
   * chapter or transcript chunk matched the query. No `.default()`: OpenAI
   * strict structured output requires every property in `required`. The client
   * also floors/coerces it and the lesson page clamps it to the video duration.
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

/**
 * Words too generic to help a keyword match. Kept small on purpose — this is a
 * token filter for GROQ `match`, not an NLP stoplist.
 */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "how", "what", "why", "when", "your", "you",
  "are", "get", "set", "use", "using", "vs", "into", "from", "this", "that",
  "does", "can", "will", "should", "about", "between",
]);

/**
 * Query -> distinct lowercased match tokens: split on non-alphanumerics, drop
 * stopwords and anything under 3 chars, de-dupe preserving order, cap at 8.
 * Pure so the server route can share it. Returns `[]` for an all-stopword query,
 * in which case the caller skips moment resolution.
 */
export function queryTokens(query: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (query || "").toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length === 8) break;
  }
  return out;
}

/** `queryTokens` wrapped for a GROQ `match` array RHS (`data` -> `*data*`). */
export function groqMatchTokens(query: string): string[] {
  return queryTokens(query).map((t) => `*${t}*`);
}
