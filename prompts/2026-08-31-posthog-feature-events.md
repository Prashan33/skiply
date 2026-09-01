# PostHog event tracking for search, video, resume, and completion

## Goal

Instrument the features shipped since the basic PostHog setup (`cc3e47a`) — intelligent
search, the lesson/video page, the course catalog — with a consistent, PII-safe set of
product-analytics events. Capture server-side where the action is server-side. Follow
PostHog's Next.js naming conventions (`object_verb`, past tense, `snake_case`).

## Skills / docs read

- `.claude/skills/integration-nextjs-app-router/SKILL.md` + `references/COMMANDMENTS.md`,
  `references/1-begin.md` — Next.js App Router PostHog patterns, server vs client capture,
  the "no PII / no user-generated content in `capture()`" rule, "capture in event handlers,
  not `useEffect`", `flushAt: 1` + awaited `flush()` for per-request server capture.
- `AGENTS.md` §7 (analytics decisions), §5 (server/client boundaries), §14 (keep it small).

## Code inspected

- `instrumentation-client.ts` — client PostHog init (`api_host: "/ingest"`, reverse proxy).
- `lib/posthog-server.ts` — `getPostHogClient()` singleton (`posthog-node`, `flushAt: 1`,
  `flushInterval: 0`); returns `null` when the token is unset.
- `components/PostHogUserIdentifier.tsx` — `identify(clerkId, { email, name, username })`
  on sign-in, `reset()` on sign-out. Left as-is (see Needs your attention).
- Existing events found:
  - server: `course_viewed` (`app/courses/[slug]/page.tsx`), `lesson_viewed`
    (`app/lessons/[slug]/page.tsx`), `search_page_viewed` (`app/search/page.tsx`).
  - client: `search_performed` + `search_result_clicked` (`components/search/SearchResults.tsx`),
    `video_played` + `video_progress` + `lesson_completed` (`components/lesson/LessonVideo.tsx`),
    `lesson_nav_clicked` (`LessonNav.tsx`), `sign_in_clicked` / `sign_up_clicked`
    (`Navigation.tsx`), `course_bookmarked` (`CourseActions.tsx`).
- `app/api/search/route.ts` — server route, the single chokepoint every search POST passes
  through; `bodySchema` currently `{ query }`. Has a `catch` that returns 503 with no
  exception capture.
- `components/lesson/LessonVideo.tsx` — YouTube IFrame API tracking only; Vimeo and Bunny
  embeds (`lib/video.ts` supports all three) get no play/depth events.
- `lib/video.ts` — `parseVideoUrl` → `youtube | vimeo | bunny`, `embedSrc` with per-provider
  start param, `enablejsapi=1` already set for YouTube.
- `components/lesson/LessonNotesContent.tsx` — server component; renders resource links as
  plain `<a target="_blank">`.
- `app/courses/page.tsx` — catalog list, server component, no filters, no event.
- No progress/resume backend exists (`app/api` has only `search`; `ResultCard` /
  `LessonSidebar` comments say per-learner progress is presentational only). The only
  resume-like affordance is the `?t=` deep link into a video second.

## Decisions & assumptions

1. **`search_performed` moves server-side** into `app/api/search/route.ts` (the action's
   real execution point, and it removes a `capture()` from a `useEffect`, which
   COMMANDMENTS forbids). Every search — homepage launcher, results-page box, direct
   `?q=` URL — funnels through this one POST, so it fires exactly once per search.
2. **`query` is captured** as an event property despite the "no user-generated content"
   rule, because the user explicitly asked for "search performed with query" and the
   search term is standard PostHog search analytics. It is the ONLY free-text property
   added anywhere. Also send `query_length`. Never copied into person properties.
3. **Result count stays client-side** (`search_results_returned`) — it is only knowable
   after the streamed response resolves. Fired from `useObject`'s `onFinish`, not a
   state-watching `useEffect`.
4. **`video_progress` → `video_watched`** (past tense, `object_verb`). Add a terminal
   **`video_watch_depth`** on unmount carrying the max percent + seconds watched — the
   watch-depth signal the PostHog video-engagement scout wants.
5. **Vimeo + Bunny get real tracking.** New client helper `lib/video-tracking.ts` with
   three adapters over each provider's native `postMessage` protocol (YouTube keeps the
   existing IFrame API; Vimeo uses `player.vimeo.com` messages; Bunny uses the Player.js
   protocol the mediadelivery iframe implements). No new dependencies. `LessonVideo`
   drives play / milestone / complete / depth uniformly from one adapter interface.
6. **`lesson_resumed`** (server, in the lesson RSC) fires when `startSeconds > 0`, with
   `source: "search"` when arriving with `?ref=search`, else `"deep_link"`. This is the
   honest scope for "resume used" today; per-learner resume-position tracking needs the
   progress backend, which this task does not build (see Needs your attention).
7. **`search_result_clicked` → `search_result_opened`** with `result_type` (the user's
   wording: "search results opened with result type"). Fresh project, ~no historical
   data, so the rename is safe.
8. **`catalog_viewed`** (server) added as the catalog funnel-top, mirroring `course_viewed`.
9. **`search_page_viewed` removed** — redundant with `search_performed` plus the
   autocaptured `$pageview` for bare `/search` visits.
10. **`lesson_resource_clicked`** — small `components/lesson/ResourceLink.tsx` client
    wrapper; property is the resource `type` enum only, no free text.
11. distinctId for every server capture is the Clerk `userId ?? "anonymous"` (existing
    pattern). No email / name / username in any `capture()` call.
12. Property key vocabulary, reused everywhere: `lesson_slug`, `course_slug`,
    `lesson_title`, `course_title`, `module_label`, `provider`, `percent`,
    `seconds_watched`, `start_seconds`, `result_type`, `result_count`, `course_count`,
    `has_results`, `relevance`, `rank`, `query`, `query_length`, `source`,
    `completion_trigger`, `resource_type`.

## Files to touch

- `app/api/search/route.ts` — capture `search_performed`; `captureException` in `catch`;
  extend `bodySchema` with optional `source`; `getPostHogClient()` + awaited `flush()`.
- `app/search/page.tsx` — remove `search_page_viewed` capture (and now-unused imports).
- `components/search/SearchResults.tsx` — delete the `useEffect` `search_performed`
  capture and its `reportedRef`; send `source` in the `submit()` body; add
  `search_results_returned` via `useObject({ onFinish })`; pass richer props to
  `onSelect`; keep `⌘K` handling untouched.
- `components/search/ResultCard.tsx` — `onSelect` signature already a bare callback; no
  change beyond what SearchResults passes. (Event name/props are built in SearchResults.)
- `components/search/SearchLauncher.tsx` — no functional change (its navigation still
  lands on `/search`, which POSTs); optional `&ref=home` passthrough only if trivial.
- `app/lessons/[slug]/page.tsx` — add `lesson_resumed` server capture when
  `startSeconds > 0`; read `?ref`.
- `components/lesson/LessonVideo.tsx` — swap to `lib/video-tracking.ts`; rename
  `video_progress` → `video_watched`; add `video_watch_depth` on cleanup; make
  `video_played` / `video_watched` / `lesson_completed` fire for all three providers;
  add `completion_trigger: "video"` + `percent` to `lesson_completed`.
- `lib/video-tracking.ts` — NEW. `attachVideoTracker(iframe, provider, { onPlay,
  onProgress })` → cleanup fn; internal per-provider adapters; no deps.
- `components/lesson/ResourceLink.tsx` — NEW client wrapper; `lesson_resource_clicked`.
- `components/lesson/LessonNotesContent.tsx` — render resources through `ResourceLink`,
  thread `lessonSlug` in from `app/lessons/[slug]/page.tsx`.
- `app/courses/page.tsx` — add `catalog_viewed` server capture (make default export
  `async` capture path; it is already `async`).
- `.posthog-events.json` — NEW at repo root: the plan array (`event_name`,
  `event_description`, `file`) for every event added or renamed.

## Event catalogue (final)

### Server (`posthog-node`, awaited `flush()`)

| Event | File | Trigger | Properties |
|---|---|---|---|
| `search_performed` | `app/api/search/route.ts` | valid search POST accepted | `query`, `query_length`, `source` |
| `lesson_resumed` | `app/lessons/[slug]/page.tsx` | RSC render, `startSeconds > 0` | `lesson_slug`, `course_slug`, `start_seconds`, `source` |
| `catalog_viewed` | `app/courses/page.tsx` | catalog RSC render | `course_count` |
| `course_viewed` | (unchanged) | — | — |
| `lesson_viewed` | (unchanged) | — | — |

### Client (`posthog-js`, in handlers / player callbacks)

| Event | File | Trigger | Properties |
|---|---|---|---|
| `search_results_returned` | `SearchResults.tsx` | `useObject` `onFinish` | `query`, `result_count`, `course_count`, `has_results` |
| `search_result_opened` | `SearchResults.tsx` → `ResultCard` `onSelect` | result card click | `query`, `result_type`, `lesson_slug`, `course_slug`, `rank`, `relevance`, `start_seconds`, `result_count` |
| `video_played` | `LessonVideo.tsx` | first play (any provider) | `lesson_slug`, `course_slug`, `lesson_title`, `provider`, `start_seconds` |
| `video_watched` | `LessonVideo.tsx` | crosses 25 / 50 / 75 / 95 % | `lesson_slug`, `course_slug`, `provider`, `percent` |
| `video_watch_depth` | `LessonVideo.tsx` | unmount, if played | `lesson_slug`, `course_slug`, `provider`, `percent`, `seconds_watched` |
| `lesson_completed` | `LessonVideo.tsx` | crosses 95 %, once | `lesson_slug`, `course_slug`, `completion_trigger: "video"`, `percent` |
| `lesson_resource_clicked` | `ResourceLink.tsx` | resource link click | `lesson_slug`, `resource_type` |
| `lesson_nav_clicked`, `course_bookmarked`, `sign_in_clicked`, `sign_up_clicked` | (unchanged) | — | — |

### Error tracking

- `app/api/search/route.ts` `catch`: `posthog.captureException(err, distinctId, { route: "/api/search" })` then `await posthog.flush()` before the 503 response.

### Removed

- `search_page_viewed` (`app/search/page.tsx`).
- Client `search_performed` `useEffect` in `SearchResults.tsx` (replaced by the server event).

## Security considerations

- `query` is the only free-text property captured, by explicit request; goes to events
  only, never person properties. `query_length` added for aggregate analysis without the
  string.
- Every other property is a slug, a derived label, an enum, a number, or a content title
  (course/lesson titles are catalog content, not personal data).
- Server captures use `distinctId: userId ?? "anonymous"` — Clerk user id only, no other
  identifiers. No IP / email / name in `capture()`.
- No PostHog key handling changes: client uses the public token via `/ingest`; server
  uses the same token in `getPostHogClient()` (server-only module). `.env.example`
  unchanged.
- `lib/video-tracking.ts` validates `event.origin` against the provider's embed origin
  before acting on any `postMessage`.

## Acceptance criteria

- `npm run lint` and `npx tsc --noEmit` clean.
- `npm run build` succeeds.
- Exactly one `search_performed` per search, server-side, with `query`.
- No `capture()` call sits inside a `useEffect` that reacts to state.
- `video_played` / `video_watched` / `lesson_completed` fire on a YouTube lesson; the
  Vimeo and Bunny adapters are wired and origin-guarded (full manual verification needs
  a Vimeo/Bunny lesson in the dataset).
- `lesson_resumed` fires only when the lesson URL has `?t=`/`?start=` > 0.
- `.posthog-events.json` lists every added/renamed event.
- No email, name, or username in any `capture()` payload.

## Checks to run

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run dev`, then with the PostHog debugger (`?__posthog_debug=true`) or the Network
  tab on `/ingest`:
  1. Home → type a query → submit. See one `search_performed` (server; check PostHog
     activity) and one `search_results_returned` (client) after results render.
  2. Click a result card → `search_result_opened` with `result_type`.
  3. On the lesson page, play the video → `video_played`; watch past 25/50/75 %
     → `video_watched`; past 95 % → `lesson_completed`; navigate away → `video_watch_depth`.
  4. Open a result's "Watch from mm:ss" (has `?t=`) → `lesson_resumed` with
     `source: "search"`.
  5. Visit `/courses` → `catalog_viewed`. Click a lesson resource link →
     `lesson_resource_clicked`.
  6. Confirm no `capture()` payload in the debugger contains an email/name.

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/?__posthog_debug=true`.
2. Search "server actions" from the hero box; on `/search` confirm results, then check
   the PostHog project activity feed for `search_performed { query, query_length,
   source }` and the console/debugger for `search_results_returned`.
3. Click the top result; confirm `search_result_opened { result_type, rank, relevance }`.
4. On the lesson page: press play, let it run past each quarter, then click a nav arrow
   to leave; confirm `video_played`, three `video_watched`, `lesson_completed`,
   `video_watch_depth`.
5. Back on `/search`, click a "Watch from …" action; confirm `lesson_resumed
   { source: "search", start_seconds }`.
6. Load `/courses`; confirm `catalog_viewed`. Click a resource link inside a lesson's
   notes; confirm `lesson_resource_clicked { resource_type }`.
7. Temporarily unset `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`; confirm the app still builds,
   boots, and the dev console logs the required-variable error (no crash).

## Needs your attention

- **Resume tracking is partial by necessity.** There is no per-learner progress backend,
  so "resume used" is tracked only for the `?t=` deep link. A true resume affordance
  (last-position write via a server route + a "Resume" button) is a separate feature —
  say the word and I will spec it.
- **`PostHogUserIdentifier` already sends `email`, `name`, `username`** to PostHog as
  person properties (not events). That predates this task and is PostHog's intended place
  for such fields, so I left it. If you want person properties trimmed to the Clerk id
  only, I will change it.
- Vimeo/Bunny event paths can only be fully verified once a lesson using one of those
  providers exists in the dataset.
