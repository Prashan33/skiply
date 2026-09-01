# Persist bookmarks and drive My Learning from them

## Goal

Make the bookmark buttons real. Bookmarking a lesson (lesson page) or a course
(course detail page) saves a per-learner record. The My Learning page then lists
**only** the courses that come from those bookmarks — the parent course of any
bookmarked lesson, plus any directly bookmarked course, de-duplicated by course.
Today the lesson bookmark button is inert, the course "Bookmark" button only
fires a PostHog event, and My Learning renders the entire catalog.

## Skills read

- `AGENTS.md` §5 (server/client boundaries, writes go through a server route with
  a write token), §7 (progress is Clerk-keyed app state; My Learning "may read
  existing progress for display"), §8 (progress record shape), §13 (checks).
- `node_modules/next/dist/docs/` — App Router route handlers, `revalidateTag`,
  server vs client components.
- Existing patterns only for Clerk / PostHog / next-sanity (per AGENTS.md §4).

## Code inspected

- `studio/schemaTypes/documents/progress.ts` — one `progress.<userId>` doc,
  `readOnly` in Studio, `entries[]` array of objects keyed by `lessonId`.
- `app/api/progress/route.ts` — the model for a Clerk-authed write route:
  `auth()` for the user (never the body), `docId = progress.${userId}`,
  `createIfNotExists` + `patch(...).commit({ visibility: "async" })` on the write
  client, returns JSON.
- `sanity/lib/write.ts` — `getWriteClient()` (Editor token, `server-only`).
- `sanity/lib/fetch.ts` — `getProgressForUser(userId)` reads
  `PROGRESS_BY_USER_QUERY` with `next: { revalidate: 0, tags: ['progress:'+userId] }`.
  `getCatalogCourses()` reads `CATALOG_COURSES_QUERY`.
- `sanity/lib/queries.ts` — `CATALOG_COURSES_QUERY` (lines 26–43) and its
  `IMAGE_FRAGMENT`; `PROGRESS_BY_USER_QUERY` (lines 262–271).
- `components/course/CourseActions.tsx` — client; the course "Bookmark" button
  currently just `posthog.capture("course_bookmarked", …)`.
- `app/lessons/[slug]/page.tsx` — server component. `lesson._id` available;
  already fetches `getProgressForUser`, computes `currentEntry`, passes
  `lessonId={lesson._id}` to `LessonVideo`. Bookmark button is inline static
  `<button aria-label="Save lesson">` around line 271–279.
- `app/courses/[slug]/page.tsx` — server component; already fetches
  `getProgressForUser`, has `course._id`, renders `<CourseActions>` ~line 222.
- `components/lesson/LessonVideo.tsx` — the client `fetch("/api/progress", …)`
  pattern with `router.refresh()` after a successful write.
- `components/course/CourseGrid.tsx` — takes `CATALOG_COURSES_QUERY_RESULT`;
  reused as-is for My Learning.

## Decisions & assumptions

1. **Storage: extend the existing `progress` doc** (user chose this). Add a
   `bookmarks` array. Each member is an object so Studio has stable `_key`s and
   to carry a timestamp:
   ```
   { _type: "bookmark", _key: <refId>, kind: "lesson" | "course", refId: <_id>, bookmarkedAt: <ISO> }
   ```
   `_key = refId` guarantees one bookmark per target and makes togg/remove a
   simple filter. `refId` stored as a plain string (not a reference), matching
   how `entries[].lessonId` avoids entangling app state with content publishing.

2. **One toggle route: `POST /api/bookmarks`**. Body `{ kind, refId, bookmarked }`
   (Zod-validated). `auth()` gives the user; `docId = progress.${userId}`.
   `createIfNotExists({ _id, _type: "progress", userId, entries: [] })` then patch
   `bookmarks` to add (dedupe by `_key`) or remove. `commit({ visibility: "async" })`.
   After commit, `revalidateTag('progress:'+userId)` so My Learning / the pages
   re-read. Returns `{ bookmarked: boolean }`. 401 if signed out, 400 on bad body,
   404 if the target `_id` doesn't resolve to a `lesson`/`course`, 502 on write
   failure. Mirrors `app/api/progress/route.ts` structure and error shape.

3. **My Learning becomes progress-driven.** New query
   `BOOKMARKED_COURSES_QUERY($courseIds, $lessonIds)`:
   ```
   *[_type == "course" && defined(slug.current) && (
       _id in $courseIds ||
       count((modules[].lessons[]._ref)[@ in $lessonIds]) > 0
   )] | order(popular desc, title asc) { <same projection as CATALOG_COURSES_QUERY> }
   ```
   Factor the CATALOG projection into a shared `CATALOG_COURSE_FIELDS` groq
   fragment so both queries stay identical and TypeGen produces compatible types
   for `CourseGrid`. Add `getBookmarkedCourses(courseIds, lessonIds)` to
   `sanity/lib/fetch.ts` with the same `tags: ['progress:'+userId]` +
   `revalidate: 0` treatment (pass `userId` in, or tag with both content tags +
   dynamic; simplest: `revalidate: 0` and `tags: ['course','lesson']`). Use
   `revalidate: 0` since it depends on per-user input.

4. **`PROGRESS_BY_USER_QUERY`** gains
   `"bookmarks": bookmarks[]{ kind, refId }`. `getProgressForUser` already
   returns the doc; callers get `.bookmarks`.

5. **Lesson page**: replace the static bookmark `<button>` with a new client
   component `components/lesson/LessonBookmarkButton.tsx` (`lessonId`,
   `initialBookmarked`). It POSTs `{ kind: "lesson", refId: lessonId, bookmarked }`,
   optimistically flips the icon (filled when bookmarked), disables while
   in-flight, reverts on failure, and keeps the existing
   `posthog.capture("lesson_bookmarked", { lesson_slug, lesson_title })`
   behaviour (add the capture; there is none today). Page computes
   `initialBookmarked = bookmarks.some(b => b.kind === "lesson" && b.refId === lesson._id)`.

6. **Course page / `CourseActions`**: add `courseId` + `initialBookmarked` props.
   The existing button toggles a course bookmark via the same route
   (`kind: "course"`), optimistic + revert, keeps
   `posthog.capture("course_bookmarked", …)`. Label/icon reflect state
   ("Bookmark" ↔ "Bookmarked", outline ↔ filled). Page passes
   `initialBookmarked = bookmarks.some(b => b.kind === "course" && b.refId === course._id)`.

7. **My Learning page** (`app/my-learning/page.tsx`): after the `auth()` gate,
   read `getProgressForUser(userId)`, split `bookmarks` into `courseIds` /
   `lessonIds`, call `getBookmarkedCourses(...)`. If both lists are empty, render
   an empty state ("You haven't bookmarked anything yet.") with a link to
   `/courses` — matching the search empty-state tone. Otherwise render
   `<CourseGrid courses={bookmarked} />`. Update the stale "presentational only /
   no backend" comment. Keep copy ("Pick up where you left off." → keep or change
   to "Your bookmarked courses."); default: "Your bookmarked courses."

8. **No design reference exists** for a filled/toggled bookmark state. Keep it
   minimal and within existing tokens: filled = `fill-current` on the same
   `lucide-react` `Bookmark`, same sizing/border classes already in the markup.
   No new colors.

## Files to touch

- `studio/schemaTypes/documents/progress.ts` — add `bookmarks` array field.
- `sanity.types.ts` — regenerated by `npm run typegen` in Studio (do not hand-edit).
- `sanity/lib/queries.ts` — `CATALOG_COURSE_FIELDS` fragment; update
  `CATALOG_COURSES_QUERY`; add `BOOKMARKED_COURSES_QUERY`; update
  `PROGRESS_BY_USER_QUERY`.
- `sanity/lib/fetch.ts` — add `getBookmarkedCourses(...)`.
- `app/api/bookmarks/route.ts` — new toggle route.
- `components/lesson/LessonBookmarkButton.tsx` — new client component.
- `app/lessons/[slug]/page.tsx` — use the new button, pass `initialBookmarked`.
- `components/course/CourseActions.tsx` — toggle behaviour + new props.
- `app/courses/[slug]/page.tsx` — pass `courseId` + `initialBookmarked`.
- `app/my-learning/page.tsx` — drive from bookmarks + empty state.
- `.env.example` — no change (reuses `SANITY_API_WRITE_TOKEN`).

## Requirements

- Browser never holds a token or writes the dataset; the only write path is
  `POST /api/bookmarks` on the server with `getWriteClient()` (AGENTS.md §5/§12).
- Learner identity comes from the Clerk session, never the request body; a
  learner can only ever write `progress.<their-own-id>`.
- `bookmarks` lives on the same doc as `entries`; `POST /api/progress` and
  `POST /api/bookmarks` must not clobber each other — each patches only its own
  field, and both `createIfNotExists` first.
- My Learning stays gated (`redirect("/sign-in")` when signed out) — unchanged.
- Toggling is idempotent: bookmarking twice = one entry; un-bookmarking a
  missing entry = no-op success.
- `CourseGrid` input shape must stay byte-compatible between catalog and
  bookmarked queries (shared fragment).

## Security considerations

- `auth()` first in the route; 401 before any parsing for signed-out callers.
- Zod-validate `kind` (enum) and `refId` (`string().min(1).max(200)`); reject
  unknown/oversized bodies.
- Confirm `refId` resolves to an actual `lesson`/`course` `_id` before writing,
  so the array can't be stuffed with arbitrary strings.
- Write token stays in `sanity/lib/write.ts` (`server-only`); never imported by a
  client component.
- No user-controlled data flows into GROQ except as parameters.

## Acceptance criteria

- Bookmark a lesson → it and its parent course appear on My Learning; icon shows
  filled state on reload.
- Bookmark a course → the course appears on My Learning.
- Un-bookmark → it disappears from My Learning after `router.refresh()`.
- Lesson + its course both bookmarked → course listed once (de-duped).
- No bookmarks → My Learning shows the empty state, not the catalog.
- Signed out → `/my-learning`, POST `/api/bookmarks` both rejected (redirect /
  401).
- `POST /api/progress` still works and doesn't drop `bookmarks`; bookmarking
  doesn't drop `entries`.

## Checks to run (web workspace)

- `npm run typegen` (Studio) after the schema change, then copy/refresh
  `sanity.types.ts` per existing workflow.
- Type check, lint.
- Production build (routes + server code changed).
- Dev server smoke test of the manual steps below.
- Studio: deploy schema so the `bookmarks` field exists on the dataset.

## Manual test steps

1. `npm run dev` (web). Sign in.
2. Open a lesson, click the bookmark button — icon fills, no error in console /
   network 200.
3. Visit `/my-learning` — the lesson's parent course card is listed.
4. Open a different course detail page, click "Bookmark" — label flips to
   "Bookmarked".
5. `/my-learning` now shows both courses, each once.
6. Un-bookmark the lesson from the lesson page; reload `/my-learning` — only the
   directly-bookmarked course remains.
7. Un-bookmark that course; `/my-learning` shows the empty state with a
   "Browse courses" link.
8. Watch enough of a lesson to trigger `POST /api/progress`; confirm in Studio
   the `progress.<userId>` doc still has the `bookmarks` array intact alongside
   `entries`.
9. Sign out, hit `/my-learning` → redirected to `/sign-in`; `curl -XPOST
   /api/bookmarks` → 401.
