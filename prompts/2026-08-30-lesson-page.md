Date: 2026-08-30

## Prompt

> @design/vertex-lesson.png Implement the lesson page from the attached UI, wired to the
> seeded Sanity content, with the lesson video playing on the page.

---

## Goal

Build the lesson route `/lessons/[slug]` as a read-only page that reproduces
`design/vertex-lesson.png` exactly on desktop and adapts sensibly down to mobile. It is
wired to the already-seeded Sanity content (`lesson` + reverse-referenced `course`), and
the lesson's YouTube video plays inline on the page via the provider's own embed (no custom
player). A `?t=<seconds>` (or `?start=`) query param starts the embed at that second — this
is the hook the future search results page needs.

Out of scope (separate AGENTS.md items, noted below): real per-learner progress
(completion + resume), video chapters/transcript ingestion, the Notes-tab authoring
backend, the notifications bell, search.

## Skills / docs read

- `AGENTS.md` — §3 (reproduce the reference exactly; responsive down to mobile; reuse
  existing components/Tailwind patterns), §5 (pages are read-only, display stored data;
  browser holds no token), §7 (playback stays on-site through a provider embed, YouTube /
  Vimeo / Bunny, link to lesson page with a start-seconds param, embed starts at that
  second using the provider's own start parameter, never send the learner to the provider;
  "Do not build a custom player"; progress surfaced as completion marks + resume), §8 (data
  model — a lesson has no parent course, derive with a reverse reference; `keyPoints`,
  `proTip`, `resources[]{type,title,description,url}`, `notes` Portable Text), §12 (private
  dataset — read token stays server-side), §13 (checks: typecheck, lint, build, dev).
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`
  and `.../page.md` — `params` and `searchParams` are promises, `await` them; client
  components read them with `use()`. `generateStaticParams` shape.
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  — server/client boundary; pass server-fetched data down as props.
- `sanity-best-practices` — not re-read in full; this task adds one GROQ query + fields to
  an existing query and follows the established `getReadClient().fetch(query, params,
  { next: { revalidate, tags } })` pattern. TypeGen is re-run after the query change.
- `portable-text-serialization` (skill) — custom `@portabletext/react` components; no
  `@tailwindcss/typography` in this project, so serializers are styled with the design
  tokens directly.

## Code / data inspected

- `app/courses/[slug]/page.tsx` — the pattern to mirror: `export const dynamicParams =
  true`, `getReadClient().fetch(QUERY, params, { next: { revalidate: 60, tags: [...] } })`,
  `generateStaticParams`, `generateMetadata`, server-side PostHog capture + `flush()`,
  `<TopNav showActions />`, `<Container as="main">`, breadcrumb with `ChevronRight`,
  black monogram tile (`font-display text-[6rem]`), meta row with `lucide-react` icons
  (`Clock`, `BarChart3`, `Users`), bottom sticky bar (`CourseProgressBar`).
- `sanity/lib/queries.ts` — `LESSON_BY_SLUG_QUERY` already exists and already reverse-
  references the course. It currently projects `"poster": poster{...}` and
  `course.modules[]{ _key, title, "lessonIds": lessons[]._ref }` (refs only, no titles).
- `sanity/lib/fetch.ts` / `client.ts` / `token.ts` — `getReadClient()` = token-bearing,
  `useCdn:false`. Token is `server-only`. Base `client` is token-less (image URLs only).
- `sanity/lib/image.ts` — `urlFor(source)`.
- `components/ui/*` — `TopNav` (has the bell + `UserButton` + `Show`), `Breadcrumbs`
  (renders plain strings, no links — the design's breadcrumb has links, so build the
  breadcrumb inline like the course page does), `Container` (max-w-1440, px-6/lg:px-10),
  `Button`, `Badge` (`lesson` variant = `bg-primary-100 text-primary-500` — used for the
  "LESSON 5.1" eyebrow and "Free" pill), `ProgressBar` (thin track, `bg-primary-500`
  fill), `Card` (`ResourceCard` is close to the design's resource cards).
- `components/course/CourseContent.tsx` — the collapsible-module accordion pattern
  (`ChevronDown` rotate, `expanded` record state, PostHog `module_expanded`) to adapt for
  the left lesson sidebar.
- `components/course/CourseProgressBar.tsx` — **precedent for progress**: it renders a
  static `PLACEHOLDER_PERCENT = 35` with a comment "Per-learner progress has no backend yet
  (separate decided feature)". The lesson sidebar follows the same convention.
- `lib/format.ts` — `formatDurationFromSeconds` (`5030 -> "1h 23m"`), `formatClock`
  (`350 -> "5:50"`), `capitalize`. No thousands-separator helper — use
  `Number(n).toLocaleString("en-US")` inline for "3,426 students" (the design shows the
  full number here, not the catalog's compact "3.4k").
- `studio/scripts/seed/seed.ndjson` (120 `lesson` docs) — **schema/seed mismatches that
  affect this page**:
  - lesson image field in the seed is **`thumbnail`**, not `poster` (schema/query use
    `poster`). Every lesson has `thumbnail`, zero have `poster`. After import these are
    real Sanity assets (`cdn.sanity.io`).
  - `resources[]` items have `_type: "resource"` in the seed (schema type is
    `lessonResource`). GROQ still projects the fields fine regardless of `_type`.
  - every lesson has `keyPoints` (string[]); 34/120 have `proTip`; every lesson has
    `resources` (mostly one `{type:"link", title, description, url}`); `notes` is Portable
    Text with `normal` + `h2` blocks and `listItem:"bullet"` items.
  - `videoUrl` is always `https://www.youtube.com/watch?v=<id>` (all YouTube).
- `studio/scripts/seed/videos.json` + `videos-to-ndjson.mjs` — `video` docs exist in the
  dataset but have **no schema type** and empty `chapters`/`chunks`. So the design's
  in-lesson chapter list (e.g. "Fetching in Server Components 21m") has no data source and
  is omitted (ingestion pipeline, AGENTS §9, is a separate task).
- `studio/sanity.cli.ts` — TypeGen scans `../{app,sanity,components,lib}/**/*.{ts,tsx}`,
  writes `../sanity.types.ts`. Run `npm run typegen` (root) after editing `queries.ts`.
- `next.config.ts` — `images.remotePatterns` allows only `cdn.sanity.io`. Poster images
  are Sanity assets, so no change needed. The video is an `<iframe>`, not `next/image`.
- `package-lock.json` — `@portabletext/react` 6.2.0 is already resolved in the tree (via
  `next-sanity`). Add it to `package.json` `dependencies` explicitly and re-run
  `npm install` so it is a first-class dep.

## Decisions & assumptions

1. **Route**: `app/lessons/[slug]/page.tsx`, server component. `export const dynamicParams
   = true`. `generateStaticParams` from `LESSON_SLUGS_QUERY`. `generateMetadata` from the
   lesson title/summary-ish (first `notes` paragraph via `pt::text`, truncated — or just
   the title). Mirror the course page's fetch/caching/PostHog structure.
2. **Query**: extend `LESSON_BY_SLUG_QUERY` (do not add a second round-trip):
   - `"poster": coalesce(poster, thumbnail){ ${IMAGE_FRAGMENT} }` — tolerate the seed's
     `thumbnail` field while keeping `poster` working if authored later.
   - `"summary": pt::text(notes[0])` for metadata / the sub-title line under the H1 (the
     design shows a one-line description there; the seed has no `lesson.summary` field, and
     the first `notes` block is a short intro paragraph that reads well as one).
   - expand the course neighbours enough to render prev/next + sidebar:
     ```
     "course": *[_type == "course" && references(^._id)][0]{
       _id, title, "slug": slug.current,
       instructor->{ name, "slug": slug.current },
       modules[]{
         _key, title,
         "lessons": lessons[]->{ _id, title, "slug": slug.current, duration, freePreview }
       }
     }
     ```
   Keep `keyPoints`, `proTip`, `resources[]{ _key, type, title, description, url }`,
   `notes[]{ ..., _type == "image" => { ${IMAGE_FRAGMENT} } }` as-is.
3. **Derived, not stored** (server component, from the expanded course):
   - flatten `modules[].lessons[]` in order → `flatLessons`.
   - `currentIndex` = index of the lesson whose `_id` matches; `moduleIndex` / `lessonInModuleIndex` → labels `Lesson {m+1}.{n+1}` and `Module {m+1} of {modules.length}`.
   - `prev` / `next` = `flatLessons[currentIndex ∓ 1]` → `{ title, slug, duration }` for
     the bottom bar; hide the side that doesn't exist.
   - breadcrumb: `All Courses` (link `/courses`) › `{course.title}` (link
     `/courses/{course.slug}`) › `{module.title}` (link `/courses/{course.slug}`) ›
     `{lesson.title}` (current, no link).
4. **Progress is presentational** (follows `CourseProgressBar` precedent, with the same
   kind of comment). No backend, no Clerk-gated writes, no `progress` schema. In the
   sidebar: lessons *before* `currentIndex` render with a filled check
   (`CheckCircle2`, `text-primary-500`), the current lesson renders the "Now playing" state
   with the play glyph, later lessons render an empty circle. The course card's "N%
   complete" + mini `ProgressBar` uses `Math.round(currentIndex / flatLessons.length * 100)`
   as a **derived placeholder** (documented as such). No `?resume=` handling.
5. **Video playback** — new `components/lesson/LessonVideo.tsx` (client), plus
   `lib/video.ts` (pure, no deps):
   - `parseVideoUrl(url): { provider: "youtube" | "vimeo" | "bunny"; id: string } | null`
     — YouTube (`watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`), Vimeo (`vimeo.com/<id>`,
     `player.vimeo.com/video/<id>`), Bunny (`iframe.mediadelivery.net/(play|embed)/<lib>/<guid>`).
   - `embedSrc(parsed, startSeconds)` — builds the provider embed URL with the provider's
     own start param: YouTube `https://www.youtube-nocookie.com/embed/<id>?start=<s>&rel=0&modestbranding=1&enablejsapi=1`,
     Vimeo `https://player.vimeo.com/video/<id>#t=<s>s`, Bunny
     `https://iframe.mediadelivery.net/embed/<lib>/<guid>?autoplay=false&t=<s>`.
   - `LessonVideo` renders a 16:9 (`aspect-video`) rounded-`--radius-lg` black container
     with the `<iframe>` (`allow="accelerated-display; autoplay; encrypted-media;
     picture-in-picture; fullscreen"`, `allowFullScreen`, `title={lesson title}`,
     `loading="lazy"`). No custom controls, no scrubber overlay — the design's player
     chrome is the provider's own player.
   - If `parseVideoUrl` returns `null`: render the poster image (or the black monogram
     fallback) with a small "Video unavailable" caption. **Never** render an outbound link
     to the provider.
   - **Instrumentation** (AGENTS §7 "a video play and how far it is watched"): for YouTube
     only, load the IFrame Player API (`https://www.youtube.com/iframe_api`, injected once,
     guarded) and attach a `YT.Player`. Fire, via `posthog-js`:
     - `video_played` once, on the first `PLAYING` state change, with
       `{ lesson_slug, lesson_title, course_slug, provider, start_seconds }`.
     - `video_progress` at 25 / 50 / 75 % watched (poll `getCurrentTime()` /
       `getDuration()` on a 5s interval while playing; each milestone fires once) with
       `{ lesson_slug, percent }`.
     - `lesson_completed` once at ≥ 95 % with `{ lesson_slug, course_slug }`.
     Vimeo/Bunny: embed only, no JS events for now (noted).
   - `?t` / `?start`: the page (`searchParams` is a promise — `await`) parses an integer
     `>= 0`, clamps to `lesson.duration`, passes `startSeconds` to `LessonVideo`. Reading
     `searchParams` opts the page into dynamic rendering — acceptable; keep the fetch on
     `revalidate: 60` tags so content is still cached.
6. **Tabs** — `components/lesson/LessonTabs.tsx` (client, `useState` "content" | "notes").
   Server renders both panels and passes them as `content` / `notes` `ReactNode` props so
   the client component only owns the toggle. Underline-style active tab
   (`text-primary-500`, `border-b-2 border-primary-500`) exactly as the design.
   - **Lesson Content panel** (server): "Overview" `<h2>` + the `notes` Portable Text
     (custom `@portabletext/react` serializers: `h2` → `font-display text-heading-2`,
     `normal` → `text-body-lg text-neutral-500 leading-relaxed`, `bullet` list → rows with
     a small `text-primary-500` check/dot, `image` → `next/image` via `urlFor`, `strong`/
     `em`/`link` marks). Then a divider, then **"In this lesson you will:"** rendered from
     `keyPoints` (orange `CheckCircle2` + `text-body` rows — same visual language as
     `components/course/LearnGrid`). Then the **Pro Tip** callout (only if `proTip`):
     `bg-primary-100` rounded-`--radius-md` box, `Lightbulb` icon, bold "Pro Tip" label,
     `proTip` text. Then a divider and **Resources**: `resources.length` cards in a
     responsive 3-col grid, each `border border-neutral-200 rounded---radius-md p-4` with
     a type icon (`code` → `Github`, `documentation`/`link` → `FileText`, `download` →
     `Download`), title, description, and an `ExternalLink` glyph; the whole card is an
     `<a href={url} target="_blank" rel="noopener noreferrer">`.
   - **Notes panel** (presentational, AGENTS §7 "Notes tab … presentational only"): a
     simple empty state ("Your notes for this lesson will appear here." + disabled-looking
     textarea or just the message). No persistence.
7. **Left sidebar** — `components/lesson/LessonSidebar.tsx` (client for the collapse
   state). Sticky on `lg+` (`lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto`),
   full-width above the content on mobile (stacks first). Contents, matching the design:
   - "← Back to course" link (`/courses/{course.slug}`, `text-primary-500`).
   - course card: black monogram tile, `course.title`, "N% complete" + mini `ProgressBar`
     (derived placeholder per decision 4).
   - one accordion section per module: header "`{module.title}`" with "Module {i+1} of
     {n}" — the module containing the current lesson starts expanded, others collapsed;
     `ChevronDown` rotate like `CourseContent`.
   - lesson rows: numbered circle OR `CheckCircle2` (completed placeholder) OR the active
     "Now playing" treatment (filled `bg-primary-500` circle + `Play` glyph, label in
     `text-primary-500`, "Now playing" sub-label). Each row is a `Link` to
     `/lessons/{slug}` with the lesson title + `formatClock(duration)`; the active row is
     not a link. PostHog `lesson_nav_clicked` on click (cheap, mirrors `CourseContent`).
   - No chapter sub-list (no data).
8. **Bottom bar** — reuse the sticky pattern from `CourseProgressBar` (`sticky bottom-0
   border-t bg-white shadow-lg`): left = "← Previous Lesson" + `prev.title` /
   `formatClock(prev.duration)`; right = `next.title` / duration + a primary "Next Lesson
   →" button (`Button` `variant="primary"`). Each links to `/lessons/{slug}`. Hide a side
   with no neighbour. This is a separate `components/lesson/LessonNav.tsx` (client, for the
   PostHog click) — do **not** reuse `CourseProgressBar` itself (different content).
9. **Bookmark icon** (top-right of the title block, in the design): render the
   `Bookmark` glyph in an outlined square button, non-functional (presentational, like the
   bell). `aria-label="Save lesson"`, `title` tooltip. No backend.
10. **PostHog** server-side in the page (mirrors course page): `lesson_viewed` with
    `{ lesson_slug, lesson_title, course_slug, course_title, module_label, is_free_preview }`,
    then `await posthog.flush()`. Guard on `getPostHogClient()` like the course page.
11. **Responsive**: desktop is a two-column grid (`lg:grid lg:grid-cols-[300px_minmax(0,1fr)]
    lg:gap-12`); below `lg` the sidebar stacks above the content and the accordion
    collapses by default except the active module. The video is always `aspect-video
    w-full`. Bottom bar stacks to two rows on mobile.

## Files expected to touch

- `app/lessons/[slug]/page.tsx` — **new**. Server component: fetch, derive, PostHog,
  layout, breadcrumb, title block, meta row, `<LessonVideo>`, `<LessonTabs>` with both
  panels, `<LessonSidebar>`, `<LessonNav>`.
- `components/lesson/LessonVideo.tsx` — **new**, client. iframe embed + YouTube IFrame API
  instrumentation.
- `components/lesson/LessonTabs.tsx` — **new**, client. Tab toggle; panels passed as props.
- `components/lesson/LessonSidebar.tsx` — **new**, client. Module accordion + lesson rows.
- `components/lesson/LessonNav.tsx` — **new**, client. Prev/next sticky bar.
- `components/lesson/LessonNotesContent.tsx` — **new**, server. Portable Text serializers
  + keyPoints + Pro Tip + Resources (the "Lesson Content" panel body). (Name it for what
  it is; the "Notes" tab empty state can live inline in the page or a tiny component.)
- `lib/video.ts` — **new**, pure. `parseVideoUrl`, `embedSrc`.
- `sanity/lib/queries.ts` — extend `LESSON_BY_SLUG_QUERY` (poster coalesce, `summary`,
  expanded `course.modules[].lessons[]->`).
- `sanity.types.ts` — regenerated by `npm run typegen` (not hand-edited).
- `package.json` / `package-lock.json` — add `@portabletext/react` to `dependencies`
  (`npm install @portabletext/react`).
- `prompts/2026-08-30-lesson-page.md` — this file; result appended after.

No schema changes. No `next.config.ts` change. No middleware change (page is public).

## Requirements

1. `/lessons/<any seeded lesson slug>` renders and visually matches
   `design/vertex-lesson.png` on desktop: left sidebar, breadcrumb, "LESSON x.y" eyebrow,
   H1, one-line description, meta row (duration · level · students), inline video,
   Lesson Content / Notes tabs, Overview + notes, "In this lesson you will" checklist,
   Pro Tip callout (when present), Resources grid, sticky Previous/Next bar.
2. The YouTube video **plays inline on the page** via the provider embed. No custom player.
3. `/lessons/<slug>?t=90` (and `?start=90`) starts the embed at 0:90. Non-integer / out-of-
   range values are ignored (start at 0).
4. All content comes from Sanity via the **server-only** read client. No token, no MCP, no
   LLM, no writes from the browser. The page is a read-only display of stored data.
5. Prev/next, module/lesson numbers, "Module N of M", and the breadcrumb are **derived**
   from authored order, never stored.
6. Progress UI (checks, "N% complete") is a clearly-commented presentational placeholder,
   consistent with `CourseProgressBar`. No `progress` document, no server route.
7. Responsive to mobile: sidebar stacks above content, accordion collapses, no horizontal
   page scroll, video keeps 16:9.
8. Reuse existing `components/ui/*` and Tailwind tokens; add new components only under
   `components/lesson/`.
9. `generateStaticParams` covers all lesson slugs; unknown slug → `notFound()`.
10. TypeGen re-run so `sanity.types.ts` matches the new query; typecheck/lint/build clean.

## Security considerations

- Read token stays server-side (`getReadClient()` / `server-only`); never reaches the
  client component props (pass only plain content values down).
- No write path introduced. Bookmark, bell, and Notes tab are inert.
- Video is embedded from `youtube-nocookie.com` / `player.vimeo.com` /
  `iframe.mediadelivery.net` only, in an `<iframe>` with a scoped `allow` and
  `rel="noopener"` on outbound resource links (`target="_blank"` + `noopener noreferrer`).
- `searchParams` `t`/`start` is parsed with `Number.parseInt`, validated `Number.isFinite`
  and `>= 0`, clamped to the lesson duration — no reflection into markup.
- No secrets added; PostHog uses the existing public key path (client) and
  `getPostHogClient()` (server) exactly as the course page.

## Acceptance criteria

- `npx tsc -p tsconfig.json --noEmit` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds; `/lessons/[slug]` present in the build output with
  `generateStaticParams` entries.
- Manual (dev server) checks below all pass.
- `git status` shows only the files listed above (+ regenerated `sanity.types.ts`,
  `package-lock.json`).

## Checks to run

1. `npm install @portabletext/react`
2. Edit `sanity/lib/queries.ts`, then `npm run typegen` (root) → `sanity.types.ts` updates,
   no TypeGen errors, `LESSON_BY_SLUG_QUERY_RESULT` gains `summary` + expanded `course`.
3. `npx tsc -p tsconfig.json --noEmit`
4. `npm run lint`
5. `npm run build`
6. `npm run dev` and walk the manual steps.

## Manual test steps

1. `npm run dev`, open `/courses/next-js-app-router-in-depth` (or any course), click a
   lesson in "Course Content" → lands on `/lessons/<slug>`.
2. Compare against `design/vertex-lesson.png` at ~1440px wide: sidebar, breadcrumb,
   "LESSON x.y" eyebrow, H1 + description, meta row, video, tabs, Overview + notes,
   checklist, Pro Tip, Resources grid, sticky Previous/Next bar. Layout/spacing/type/color
   match.
3. The video plays inline (click play in the embedded player). You are not navigated to
   youtube.com.
4. Visit `/lessons/<slug>?t=120` → the embedded player starts around 2:00.
5. Open a lesson that has a `proTip` (e.g. `nextjs-app-router-in-depth-file-system-routing`)
   → Pro Tip callout shows. Open one without → callout is absent, no empty box.
6. Click the "Notes" tab → presentational empty state, no error.
7. In the sidebar: the current lesson shows "Now playing", earlier lessons show a check
   (placeholder), later lessons an empty circle; collapsing/expanding a module works;
   clicking another lesson navigates.
8. Bottom bar: "Previous Lesson" / "Next Lesson" show the neighbour titles + durations and
   navigate; on the first lesson of the course the Previous side is hidden, on the last the
   Next side is hidden.
9. Resize to ~375px: sidebar stacks above content, module accordion collapsed except the
   active module, video stays 16:9, no horizontal scroll, bottom bar readable.
10. `/lessons/does-not-exist` → 404.
11. PostHog (project live events, or network tab to `/ingest`): `lesson_viewed` on load;
    `video_played` on first play; `video_progress` at 25/50/75%; `lesson_completed` near
    the end.

## Needs your attention

- **Schema ↔ seed drift** (pre-existing, not fixed here): the seed's lesson image field is
  `thumbnail` and resource items are `_type:"resource"`, while the Studio schema defines
  `poster` and `lessonResource`. This page tolerates it (query `coalesce(poster,
  thumbnail)`; resources projected by field, not type). Worth a follow-up to reconcile the
  schema or re-seed — `COURSE_BY_SLUG_QUERY` also projects `poster` and currently gets
  `null` for every course lesson thumbnail.
- **Progress** is a visual placeholder only. Wiring real completion + resume (the AGENTS §7
  progress feature: `progress` doc keyed by Clerk user id, server route with a write token)
  is a separate task.
- **Video chapters / transcript**: the design's in-lesson chapter list is omitted — `video`
  docs have empty `chapters`/`chunks` and no schema type yet (AGENTS §9 ingestion pipeline).
- **Vimeo / Bunny**: embed + start-seconds are implemented, but play/progress analytics are
  YouTube-only for now. All seeded videos are YouTube, so this is not exercised yet.
- **`@tailwindcss/typography`** is not installed; `notes` uses hand-written serializers. If
  you want the richer prose defaults later, add the plugin.
- **No brand GitHub icon** in this `lucide-react` build — `code`-type resources use `Code2`.
- `/lessons/[slug]` is a **dynamic** route in the build output because it reads
  `searchParams` (`?t`) — param shells still prerender via `generateStaticParams`; the
  page renders per request. Expected.

---

## Result

Built `/lessons/[slug]` + `components/lesson/{LessonVideo,LessonTabs,LessonNotesContent,
LessonSidebar,LessonNav}.tsx` + `lib/video.ts`; extended `LESSON_BY_SLUG_QUERY` (poster
`coalesce(poster, thumbnail)`, `pt::text(notes[0])` summary, expanded `course.modules[].
lessons[]->`, `course.level`); regenerated `sanity.types.ts`; added `@portabletext/react`
to `dependencies`.

Checks (all pass):
- `npx tsc -p tsconfig.json --noEmit` — clean.
- `npm run lint` — 0 errors (pre-existing warnings in `.agents/` skill templates only).
- `npm run build` — succeeds; `/lessons/[slug]` present, 136 static param shells generated.
- Dev server: `/lessons/nextjs-app-router-in-depth-file-system-routing` → 200, renders
  title / `Lesson 1.1` / "Now playing" / "In this lesson you will" / "Pro Tip" /
  "Next Lesson"; embed src is `youtube-nocookie.com/embed/9602Yzvd7ik?...`; `?t=120` adds
  `&start=120`; first lesson hides Previous, mid lesson shows it; unknown slug → 404.
