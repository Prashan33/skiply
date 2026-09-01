# Learner progress backend + watch-gated lesson completion

## Goal
Today every "completed" checkmark is a **placeholder derived from a lesson's position**
in the course (`LessonSidebar`, `CoursePage` progress bar). Opening any lesson makes
every earlier lesson show as done, with no video watched.

Replace that with a real per-learner progress record (AGENTS.md §7/§8) and gate lesson
completion on **actual watch time**:

- A lesson is complete once the learner has watched **≥ 7 minutes (420s)** of its video.
- For videos **shorter than 7 minutes**, complete at **≥ 90% of the video's duration**.
- Watch time is **cumulative across visits** and counts **unique seconds** of the video
  actually played (scrubbing back over already-watched parts does not re-count; skipping
  forward does not count the skipped span).
- Once `completed` is true it never flips back.

Drive the lesson sidebar checkmarks, the sidebar "% complete", and the course page
"Your Progress" bar from this real data. Add a completion check to the course-content
lesson rows. Use the stored last position as a resume point.

## Skills / docs read
- `AGENTS.md` — §5 (server/client boundaries; writes go through a server route with a
  write token; browser never writes progress), §7 (progress tracked per learner keyed by
  Clerk user id; completion marks + resume affordance on catalog/course/lesson; progress
  kept apart from read-only content), §8 (progress record shape), §12 (write token is
  server-only, used only inside a server route; private dataset; keep keys in env with a
  committed `.env.example`), §13 (checks), §3 (reproduce design, no restyle).
- `node_modules/next/dist/docs/` — App Router route handlers, `runtime`, dynamic rendering,
  `cache: "no-store"`, `revalidateTag`, Server/Client component boundary.
- `sanity-best-practices` — `defineType`/`defineField`, deterministic `_id`, `createIfNotExists`,
  key-scoped array patches / transactions, TypeGen (`sanity schemas extract && sanity typegen generate`).

## Code inspected
- `components/lesson/LessonVideo.tsx` — client component. `attachVideoTracker` gives
  `onPlay` + `onProgress({ percent, currentSeconds, durationSeconds })`. Already de-dupes
  PostHog milestones and fires `lesson_completed` (analytics only) at 95%. `fired` ref holds
  per-mount state. Cleanup fires a `video_watch_depth` event with `furthestSeconds`.
- `lib/video-tracking.ts` — YouTube polls `getCurrentTime()` every 5s while playing; Vimeo/Bunny
  emit `timeupdate`. No persistence, no server calls. Origin-checked. Do not change its contract.
- `app/lessons/[slug]/page.tsx` — server component. Fetches lesson via `getReadClient()`
  (`revalidate: 60`, tags). Calls `auth()` (already dynamic). Flattens `course.modules[].lessons[]`
  in authored order. `currentIndex` drives: `percentComplete = round(currentIndex/flat.length*100)`
  and per-lesson `status` = `done` if `flatIdx < currentIndex`, else `active`/`upcoming`;
  `module.completed = mi < activeModuleIndex`. `startSeconds` from `?t=`/`?start=` via
  `parseStartSeconds`. Passes `lesson._id` etc. is available.
- `components/lesson/LessonSidebar.tsx` — presentational. Renders `status` per lesson
  (`done` → check, `active` → play, `upcoming` → empty) and `module.completed`, plus
  `percentComplete`. Doc comment says progress "has no backend yet".
- `app/courses/[slug]/page.tsx` — server component. `auth()`, `getCourseBySlug` (`revalidate: 60`).
  Builds `continueHref` = first lesson with a slug. Renders `<CourseProgressBar continueHref=... />`
  and `<CourseContent modules=... />`.
- `components/course/CourseProgressBar.tsx` — client. `const PLACEHOLDER_PERCENT = 35;` hard-coded.
- `components/course/CourseContent.tsx` — client. Lesson rows show `label` / title / Free badge /
  clock. No completion mark today.
- `app/my-learning/page.tsx` — presentational; lists the whole catalog. Left as-is this PR (see below).
- `sanity/lib/fetch.ts` — `getReadClient()` = `client.withConfig({ token: requireToken(), useCdn: false })`;
  helper fns pass `next: { revalidate, tags }`. `import 'server-only'`.
- `sanity/lib/client.ts` — base token-less `client` (`useCdn: true`).
- `sanity/lib/token.ts` — `import 'server-only'`; `SANITY_API_READ_TOKEN`, `requireToken()`.
- `sanity/lib/queries.ts` — `defineQuery` GROQ; TypeGen output in `sanity.types.ts`.
- `proxy.ts` — Next 16 renamed `middleware.ts` → `proxy.ts`; `clerkMiddleware()` with **no**
  route protection (per-page `auth()` gating). `/(api|trpc)(.*)` is in the matcher.
- `studio/schemaTypes/index.ts` — `schema.types` array; documents then objects.
- `studio/schemaTypes/documents/lesson.ts` — `duration` is `number`, `required().min(0).integer()`
  (always present). `slug` required.
- `studio/scripts/seed/agent-context.ndjson` — `groqFilter: '_type in ["course","lesson"]'`, so a
  new `progress` type is **already excluded** from the Context MCP / search.
- `package.json` — web scripts: `dev`, `build`, `lint` (`eslint`), `typegen`
  (`npm --prefix studio run typegen`). No `typecheck` script → use `npx tsc --noEmit`.
- `.env.example` — canonical env list; documents `SANITY_API_READ_TOKEN` as server-only.
- No `app/api/progress` route, no write client, no `progress` schema exists.

## Decisions & assumptions
1. **One `progress` document per learner**, deterministic `_id = "progress." + userId`
   (Clerk ids are `user_…`, safe in a Sanity `_id`). Because `userId` comes only from the
   authenticated Clerk session, the id cannot be forged.
2. **Schema `progress`** (new document type), app-state, decoupled from content:
   - `userId: string` (required)
   - `entries: array of object` (`_key` = the lesson `_id`), each:
     - `lessonId: string` — the lesson document `_id`
     - `secondsWatched: number` — cumulative unique seconds watched (integer, ≥ 0)
     - `completed: boolean`
     - `completedAt: datetime` (optional)
     - `lastPosition: number` — resume position in seconds (integer, ≥ 0)
     - `updatedAt: datetime`
   - Store `lessonId` as a **plain string, not a reference** — keeps app state apart from
     the read-only content graph (AGENTS.md §7). Grouping by course for display is done by
     joining in GROQ on `*[_type=="lesson" && _id in $ids]` when needed.
   - `readOnly: true` for the whole type (written only by the server route),
     `__experimental_omnisearch_visibility: false`, `PlayIcon` or `UserIcon`, a `preview`
     showing `userId` + entry count. Registered in `studio/schemaTypes/index.ts` after `video`.
3. **Completion threshold** (server-authoritative), pure helper `lib/progress.ts`:
   `completionThresholdSeconds(durationSeconds)` → `durationSeconds > 0 && durationSeconds < 420
   ? Math.floor(durationSeconds * 0.9) : 420`. Overridable for QA via
   `PROGRESS_COMPLETE_SECONDS` (server-only env; when set and > 0, it replaces the 420 floor,
   90%-for-short still applies against it). Default 420.
4. **Unique-seconds measurement (client, `LessonVideo`)**: keep a `Set<number>` of
   `Math.floor(currentSeconds)` buckets, added only for *contiguous playback*: on each
   `onProgress` tick, if `0 < currentSeconds - lastTickSeconds ≤ 12` (i.e. a normal
   play-advance, not a scrub/seek), add every integer in `[floor(lastTickSeconds),
   floor(currentSeconds)]`. A single tick otherwise just adds `floor(currentSeconds)`.
   `sessionUnique = set.size`. Re-watching already-seen seconds doesn't grow the set;
   skipped spans are never added.
5. **Cumulative across visits**: the server stores the cumulative `secondsWatched` count.
   The client is seeded on mount with the server's stored value (`initialSecondsWatched`)
   and, per write, sends `secondsWatched = initialSecondsWatched + sessionUnique`
   (idempotent under retf/retries — it's an absolute value, not an increment). Cross-session
   de-dup of the *same* seconds is not attempted; that only matters before completion, and
   7 minutes only has to be reached once (then `completed` latches).
6. **Server route `POST /api/progress`** (`app/api/progress/route.ts`, `runtime = "nodejs"`,
   `dynamic = "force-dynamic"`):
   - `const { userId } = await auth();` → `401` if falsy. `userId` is **never** read from the body.
   - Body (Zod): `{ lessonId: string (non-empty), secondsWatched: number ≥ 0, lastPosition: number ≥ 0 }`.
     Reject with `400` on parse failure.
   - Resolve the lesson server-side: `getReadClient().fetch('*[_type=="lesson" && _id==$lessonId][0]{ "id": _id, duration }', { lessonId }, { cache: "no-store" })`.
     `null` → `404` (unknown/incorrect id, no write).
   - Clamp: `secondsWatched = clamp(round(secondsWatched), 0, duration || secondsWatched)`;
     `lastPosition = clamp(round(lastPosition), 0, duration || lastPosition)`. The duration
     clamp makes it impossible to "complete" past the real video length.
   - `threshold = completionThresholdSeconds(duration)`.
   - Load existing doc: `getReadClient().fetch('*[_id == $id][0]', { id }, { cache: "no-store" })`.
     Compute the next `entries` array in JS: upsert the entry by `_key === lessonId`,
     `secondsWatched = max(existing.secondsWatched ?? 0, incoming)` (monotonic — never regress),
     `completed = (existing.completed ?? false) || secondsWatched >= threshold`,
     `completedAt` set once on the transition, `lastPosition = incoming`, `updatedAt = now`.
   - Persist with the **write client** in one transaction:
     `getWriteClient().transaction().createIfNotExists({ _id: id, _type: "progress", userId, entries: [] }).patch(id, p => p.set({ entries: nextEntries })).commit({ visibility: "async" })`.
   - `revalidateTag("progress:" + userId)` so the lesson/course pages re-read.
   - Respond `200 { completed, secondsWatched, threshold }`.
7. **Write client** `sanity/lib/write.ts` — `import "server-only"`; `getWriteClient()` =
   `createClient({ projectId, dataset, apiVersion, useCdn: false, token: requireWriteToken() })`
   reading `SANITY_API_WRITE_TOKEN` (needs an **Editor** token). Never imported by a client component.
8. **Reads**: `PROGRESS_BY_USER_QUERY` in `queries.ts`:
   `*[_type == "progress" && userId == $userId][0]{ entries[]{ lessonId, secondsWatched, completed, lastPosition } }`.
   `getProgressForUser(userId)` in `fetch.ts` → `getReadClient().fetch(q, { userId },
   { next: { tags: ["progress:" + userId] }, cache: "no-store" })` (per-user, mutable — never
   statically cached; pages are already dynamic via `auth()`).
9. **Lesson page** (`app/lessons/[slug]/page.tsx`):
   - `const progress = userId ? await getProgressForUser(userId) : null;`
     Build `completedIds = new Set(entries.filter(e => e.completed).map(e => e.lessonId))`
     and `entryById = new Map(...)`.
   - Per-lesson `status`: `active` for the current lesson, else `done` iff
     `completedIds.has(l._id)`, else `upcoming`. (No longer position-based.)
   - `module.completed` = module has ≥ 1 lesson **and every** lesson `completedIds.has(id)`.
   - `percentComplete` = `flat.length ? round(completedIds ∩ flat / flat.length * 100) : 0`.
   - **Resume**: `startSeconds = parseStartSeconds(sp.t ?? sp.start, duration)`; if that is `0`
     and the current lesson's entry has `lastPosition` between `1` and `duration - 15` and it
     is not completed, use `lastPosition`.
10. **Course page** (`app/courses/[slug]/page.tsx`):
   - Fetch progress as above; `completedIds` over the course's flattened lessons.
   - `percentComplete` → pass to `<CourseProgressBar percent={…} />`.
   - `continueHref` → first lesson (with slug) **not** in `completedIds`; fall back to the
     first lesson; if that lesson has an in-progress `lastPosition`, append `?t=<seconds>`.
   - Pass `completedIds` (as `string[]`) into `<CourseContent>` and render a completion
     check in the lesson row: replace the `label` cell content with a small check circle
     (reuse the sidebar's `Check` treatment: `border-primary-500 text-primary-500`) when done,
     else keep the `label`. No other visual change.
11. **`CourseProgressBar`** — add required `percent: number` prop, delete `PLACEHOLDER_PERCENT`,
   use `percent` for both the number and the `ProgressBar value`. Update the doc comment.
12. **`LessonVideo`** — new props `lessonId: string`, `initialSecondsWatched: number`,
   `initialCompleted: boolean`. Add to the effect:
   - session `Set` + `lastTickSeconds` + `lastSentUnique` + `completed` (seeded from
     `initialCompleted`) + `lastPosition` in the `fired` ref.
   - In `onProgress`: update the set (decision 4), track `lastPosition = currentSeconds`.
   - `maybeSend()` (throttled): call when `sessionUnique - lastSentUnique ≥ 15`. `POST`
     `/api/progress` with `{ lessonId, secondsWatched: initialSecondsWatched + sessionUnique,
     lastPosition: round(lastPosition) }` via `fetch(..., { keepalive: true })`; on a
     `{ completed: true }` response when not already completed, set the flag and call
     `router.refresh()` once (so the server-rendered sidebar/bar pick up the check).
   - On cleanup: if `sessionUnique > lastSentUnique` or `lastPosition` moved, send a final
     beacon (`fetch(..., { keepalive: true })`, fire-and-forget). Keep the existing
     `video_watch_depth` PostHog capture.
   - Guard everything on `provider` being set and the POST failing silently (never throw
     into playback). No token or env on the client.
13. **My Learning** (`app/my-learning/page.tsx`) — **out of scope** this PR; it stays a
   catalog list. Follow-up: filter to courses with progress + show per-course %. Noted in report.
14. **TypeGen** — after the schema + query changes, run `npm run typegen`; commit the
   regenerated `sanity.types.ts`. Do not hand-edit it.
15. **Studio deploy** — the new `progress` type needs `sanity deploy` (schema) for authoring
   visibility; it does **not** affect search (already outside the Context `groqFilter`).
   No content import — `progress` docs are created at runtime by the route.

## Files to touch
- `studio/schemaTypes/documents/progress.ts` — **new** schema.
- `studio/schemaTypes/index.ts` — register `progress`.
- `sanity/lib/write.ts` — **new** server-only write client + `requireWriteToken()`.
- `sanity/lib/queries.ts` — `PROGRESS_BY_USER_QUERY`.
- `sanity/lib/fetch.ts` — `getProgressForUser(userId)`.
- `lib/progress.ts` — **new** pure helpers (`completionThresholdSeconds`, shared types).
- `app/api/progress/route.ts` — **new** `POST` handler.
- `components/lesson/LessonVideo.tsx` — watch-time tracking + persistence + resume seed.
- `app/lessons/[slug]/page.tsx` — real status / percent / resume.
- `components/lesson/LessonSidebar.tsx` — refresh the stale doc comment only (props unchanged).
- `app/courses/[slug]/page.tsx` — real percent + continueHref + pass completed set.
- `components/course/CourseProgressBar.tsx` — `percent` prop, drop placeholder.
- `components/course/CourseContent.tsx` — completion check in the lesson row.
- `.env.example` — add `SANITY_API_WRITE_TOKEN` (server-only) and commented
  `PROGRESS_COMPLETE_SECONDS`.
- `sanity.types.ts` — regenerated by TypeGen.

## Requirements
- Signed-in learner: a lesson shows a completion check **only** after ≥ 420s (or ≥ 90% for
  sub-7-min videos) of unique video watched, cumulative across visits; never from mere
  navigation.
- `completed` never regresses; `secondsWatched` is monotonic server-side.
- Sidebar "% complete", the course "Your Progress" bar, and course-content row checks all
  reflect the same real `completedIds`.
- Reopening a partially-watched, not-completed lesson resumes near `lastPosition`
  (unless `?t=`/`?start=` is given, which still wins).
- Signed-out: no progress calls; pages render with 0% / no checks (no crash).
- No visual change beyond: real numbers in the two progress bars, and a check replacing the
  lesson number in course content when done.
- `npm run build` succeeds; `/api/progress` is dynamic and not statically analysed as static.

## Security considerations
- `SANITY_API_WRITE_TOKEN` is server-only (no `NEXT_PUBLIC_`), imported only through
  `sanity/lib/write.ts` (`import "server-only"`), used only inside the route handler.
- The route derives `userId` from the Clerk session, never from the request body, and the
  progress `_id` is `"progress." + userId` — a learner can only ever write their own record.
- Body is Zod-validated; `secondsWatched`/`lastPosition` are clamped to `[0, lesson.duration]`,
  so a forged large value cannot complete a lesson beyond its real length. The completion
  threshold is computed server-side. (A determined user can still self-report up to the real
  duration and complete a lesson without watching — accepted: no grades/certificates depend
  on this.)
- `progress` is `readOnly` in Studio, hidden from omnisearch, and outside the Context MCP
  `groqFilter` — it can't leak into search results or be edited by authors.
- Per-user progress reads use `cache: "no-store"` + a `progress:<userId>` tag; no cross-user
  cache bleed. The browser never reads or writes the dataset directly.
- `PROGRESS_COMPLETE_SECONDS` is read only on the server.

## Acceptance criteria
- Fresh signed-in user opens Lesson 3 of a course directly → sidebar shows Lessons 1–2 as
  **upcoming** (empty), Lesson 3 active. (Previously they showed as done.)
- Play the lesson video to ~30s, leave, return → still not complete; playback resumes ~30s.
- Accumulate ≥ 7 min of unique playback (across two visits) → within one throttle window the
  row and sidebar show a check, "% complete" increases, and a `progress.<userId>` document
  exists in Sanity with `entries[0].completed == true` and `completedAt` set.
- A lesson whose video is < 7 min completes at ~90% watched.
- Scrub back and re-watch the first minute repeatedly → `secondsWatched` does not inflate past
  real unique coverage; skipping to the end does not complete it.
- Complete every lesson in a module → the module row shows its completed state; course
  "Your Progress" reaches 100% and "Continue Learning" points at the last/again-first lesson.
- Signed-out visit to a lesson/course page → renders, 0%, no network calls to `/api/progress`.

## Checks to run
- `npm run typegen` (Studio schema extract + TypeGen); commit `sanity.types.ts`.
- Web: `npx tsc --noEmit`, `npm run lint`, `npm run build` (routes + server module added).
- `cd studio && npx sanity deploy` (schema — new `progress` type) — report output.
- Manual: run `npm run dev`, exercise the acceptance criteria above while signed in with a
  Clerk test user; for the 7-minute case either use a sub-7-min lesson (90% rule) or set
  `PROGRESS_COMPLETE_SECONDS=20` in `.env.local` to make it quick, then restore it. Inspect
  the `progress.<userId>` doc in Vision / Studio.
- Confirm `SANITY_API_WRITE_TOKEN` (Editor) is present in `.env.local` before testing writes.

## Out of scope / follow-ups
- My Learning page: filter to in-progress courses + per-course %.
- Catalog cards: per-course progress ring.
- A manual "Mark complete" control.
- Cross-session de-duplication of identical watched seconds.
