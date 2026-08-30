Date: 2026-08-30

## Prompt

> implement a course page as shown in the attached UI wired with seeded sanity
> content. design/vertex-course.png

## Goal

Ship the course detail route `/courses/[slug]`, rendered from the seeded Sanity
content, matching `design/vertex-course.png` exactly on desktop and degrading
sensibly to mobile. Read-only page: it displays stored content only. No writes,
no token in the browser.

## Skills read

- `AGENTS.md` (full) — boundaries, workflow, decisions already made.
- `sanity-best-practices` → `references/nextjs.md` — Live Content API
  (`sanityFetch`), `generateStaticParams` with `perspective: 'published'` +
  `stega: false`, `notFound()` for missing docs, `useCdn: false` for static
  params.
- Next.js docs `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md`
  and `.../01-getting-started/03-layouts-and-pages.md` — `params` is a Promise;
  `PageProps<'/courses/[slug]'>` is a global helper, no import.

## Code inspected

- `sanity/lib/queries.ts` — `COURSE_BY_SLUG_QUERY` and `COURSE_SLUGS_QUERY`
  already exist and return everything this page needs (title, summary, level,
  price, popular, studentCount, coverImage, learningOutcomes[{icon,title,
  description}], instructor, category, modules[{title,summary,lessons[]->{
  title,slug,duration,freePreview,studentCount,poster}}]). No query changes.
- `sanity.types.ts` — `COURSE_BY_SLUG_QUERY_RESULT`, `COURSE_SLUGS_QUERY_RESULT`
  generated. Every scalar is nullable — guard in the UI.
- `sanity/lib/live.ts` / `fetch.ts` — `sanityFetch` (token-bearing, server only)
  for the page; `getReadClient()` (`useCdn:false`) for `generateStaticParams`.
- `sanity/lib/image.ts` — `urlFor()` builder (not needed if we skip coverImage,
  see decision below; keep available for instructor use if wanted later).
- `app/page.tsx` — homepage is the catalog, at `/`. Uses `TopNav showActions`,
  `Container`, monogram course icons (`N` on `bg-neutral-900`), design tokens.
- `components/ui/*` — `Container` (max-w-1440, px-6/lg:px-10), `TopNav`,
  `Breadcrumbs` (takes `string[]`), `Badge` (`popular` variant = filled orange,
  but design's POPULAR pill is light: `bg-primary-100 text-primary-500` — use
  that treatment), `Button` (primary/secondary/tertiary), `ProgressBar`
  (`value`, `showLabel`). `lib/cn.ts` for class merge.
- `studio/schemaTypes/**` — `duration` is integer seconds; module label /
  lesson label / module count are derived from order, not stored. Lesson has no
  parent course. `learningOutcome.icon` holds a lucide-react icon name; seed
  uses: `layers workflow gauge rocket sparkles shield puzzle code`.
- `studio/scripts/seed/seed.ndjson` — 10 courses, 6 categories, 5 instructors,
  120 lessons. Course `nextjs-app-router-in-depth` is the closest match to the
  reference (popular, intermediate, 5 modules). `coverImage` on every course is
  a random `picsum.photos` URL (not a branded monogram); lesson image field in
  seed is `thumbnail` (mismatch vs schema `poster`) so lesson posters resolve
  null — fine, we don't render them here.

## Decisions & assumptions

1. **Route:** `app/courses/[slug]/page.tsx` (Server Component). Add
   `app/courses/[slug]/not-found.tsx`? No — rely on the app's default; call
   `notFound()` when the query returns null. `generateStaticParams` from
   `COURSE_SLUGS_QUERY` via `getReadClient()`. `export const dynamicParams =
   true` so new courses still render.
2. **Data fetch:** one `sanityFetch({ query: COURSE_BY_SLUG_QUERY, params:
   { slug } })` in the page. `generateMetadata` does a second `sanityFetch`
   with `stega: false` for `title` + `summary` (SEO rule).
3. **Hero visual (user-confirmed):** dark rounded monogram tile showing the
   course title's first letter in `font-display`, matching the reference and the
   existing homepage `CourseCard` icon style. The seeded `picsum` `coverImage`
   is **not** rendered. Tile: `bg-neutral-900 text-white`, large
   (`h-64 w-64` desktop, responsive square), `rounded-[var(--radius-lg)]`.
4. **Progress UI (user-confirmed):** presentational placeholder. There is no
   per-learner progress backend (separate decided feature). Render, with static
   values, exactly as designed:
   - Hero primary CTA: `Continue Learning` → links to the first lesson of the
     first module (`/lessons/<firstLessonSlug>`), arrow icon. Secondary
     `Bookmark` button (outline, bookmark icon), no-op.
   - Sticky bottom bar: `Your Progress` / `35% complete` / `ProgressBar
     value={35}` / `Continue Learning` button. `position: sticky; bottom: 0`,
     white, top border, subtle shadow, sits above content, full-bleed inside a
     `Container`. Hidden from print. A short code comment marks the 35% as a
     placeholder pending the progress feature.
   - Lesson rows show the `FREE` badge from `freePreview` (real data) but no
     completion checkmarks (needs progress).
5. **Derived values (real data, computed in a helper):**
   - Course total duration = sum of every lesson `duration` across all modules →
     formatted `Hh Mm` (e.g. `18h 24m`); if `< 1h`, `Mm`.
   - Module count = `modules.length` → `N modules`.
   - Per-module duration = sum of that module's lesson durations → same `Hh Mm`
     / `Mm` format.
   - Level → capitalized (`intermediate` → `Intermediate`).
   - `studentCount` → compact (`18240` → `18.2k students`, `2100` → `2.1k`).
   - Lesson label `Lesson {moduleIndex+1}.{lessonIndex+1}` when a module is
     expanded.
6. **Course Content list is a Client Component**
   (`components/course/CourseContent.tsx`, `"use client"`): needs
   expand/collapse per module (chevron rotates) and a `Show all N modules` /
   `Show less` toggle that initially caps the list at 6 rows (matches the
   reference showing 6 of 12 with the button). Rows are numbered by module
   order. Expanding a row reveals its lessons: `Lesson N.M` · title ·
   `mm:ss` duration · `FREE` badge if `freePreview`, each linking to
   `/lessons/<slug>`. The page passes already-serializable plain data
   (no Portable Text here) into it.
7. **What you'll learn:** 2-col grid (1-col mobile) of outcome cards; icon
   resolved from a small **allow-listed** `lucide-react` map keyed by the
   `icon` string (the 8 seed values above), falling back to a default
   (`Sparkles`). Icon in a `bg-primary-100 text-primary-500` rounded badge,
   per design.
8. **Meta row** under the summary: `level` (BarChart3), total duration (Clock),
   `N modules` (FileText), `N students` (Users) — icon + label, `text-small
   text-neutral-500`, matching the reference.
9. **Breadcrumbs:** `All Courses` (link to `/`) › `<course title>`. `TopNav`
   with `showActions`. Page background `bg-neutral-50`, faint diagonal texture
   as on the homepage is out of scope (not clearly in this design) — plain
   `bg-neutral-50`.
10. **No new deps.** Icons from `lucide-react` (already installed). No image
    domains config needed (no remote images rendered).

## Files to touch

- `app/courses/[slug]/page.tsx` — new. Server Component, data fetch, layout,
  `generateStaticParams`, `generateMetadata`, `notFound()`.
- `components/course/CourseContent.tsx` — new. Client Component: module
  accordion + show-all toggle.
- `components/course/LearnGrid.tsx` — new (or inline in page). "What you'll
  learn" grid with the icon map. Keep as a small server component/module.
- `components/course/CourseProgressBar.tsx` — new. Sticky bottom presentational
  progress bar.
- `lib/format.ts` — new. `formatDurationFromSeconds`, `formatCompactCount`,
  `capitalize`. Pure, unit-testable, no deps.
- Possibly `components/ui/Badge.tsx` — only if a light "POPULAR" treatment is
  cleaner as a new variant; otherwise pass `className` override. Prefer the
  override, no component change.

No changes to `sanity/**`, `studio/**`, queries, or the Studio.

## Requirements

- Desktop output matches `design/vertex-course.png`: spacing, type scale
  (`font-display` headings), colors (design tokens only), the light POPULAR
  pill, the two-column outcomes grid, the numbered module list with right-aligned
  durations and chevrons, the centered `Show all 12 modules` button, and the
  sticky progress footer.
- Responsive: below `lg`, hero stacks (tile above the title block); outcomes and
  module inner content go single-column; sticky footer stacks label over bar,
  keeps the button. No horizontal scroll at 375px.
- All displayed content comes from the `COURSE_BY_SLUG_QUERY` result. Only the
  progress numbers/labels are placeholder, clearly commented.
- Null-safe: missing `summary`, empty `learningOutcomes`, missing `price`,
  `studentCount`, or `duration` must not throw; sections with no data are
  omitted gracefully.
- `notFound()` for an unknown slug.

## Security considerations

- Page and metadata use `sanityFetch` (server only, token via
  `serverToken`/`browserToken` in `live.ts`). `generateStaticParams` uses
  `getReadClient()` (server only). No token, no Sanity client, no MCP, no LLM in
  any client component. `CourseContent.tsx` receives only plain serializable
  props.
- No user input beyond the route slug (used only as a GROQ `$slug` param —
  parameterized, not interpolated).
- No new env vars. `.env.example` unchanged.

## Acceptance criteria

1. `/courses/nextjs-app-router-in-depth` renders the full page from seed data
   and visually matches the reference on a 1440px viewport.
2. Total duration, module count, per-module durations, level, and student count
   are computed/formatted correctly from the data.
3. Module rows expand/collapse; `Show all 12 modules` reveals the rest and
   toggles to `Show less`.
4. `Continue Learning` (hero and sticky footer) links to
   `/lessons/<first lesson slug>`. `FREE` badge appears only on
   `freePreview` lessons.
5. Unknown slug → 404.
6. `/courses/<any other seeded slug>` also renders without error.
7. Mobile (375px): no horizontal scroll, layout stacks sensibly, desktop
   unchanged.

## Checks to run (web workspace, repo root)

- `npm run typegen` (no query change, but confirm types are current).
- `npx tsc --noEmit` (type check).
- `npm run lint`.
- `npm run build` (new route + server code).
- `npm run dev` and manually verify the steps below.

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/courses/nextjs-app-router-in-depth`.
2. Confirm hero: monogram tile, POPULAR pill, title, summary, meta row
   (level · duration · modules · students), `Continue Learning` + `Bookmark`.
3. Confirm "What you'll learn": 4 outcome cards, correct icons, 2×2 on desktop.
4. Confirm "Course Content": 6 module rows visible, right-aligned durations,
   header shows `12 modules · <total>`. Click a row → lessons appear with
   `Lesson N.M`, titles, `mm:ss`, `FREE` where applicable, linking to
   `/lessons/...`. Click `Show all 12 modules` → all rows show, button becomes
   `Show less`.
5. Confirm sticky footer stays pinned while scrolling and its
   `Continue Learning` links to the first lesson.
6. Visit `/courses/does-not-exist` → 404.
7. Visit `/courses/practical-web-security` → renders cleanly (fewer outcomes /
   different level still fine).
8. Resize to 375px → no horizontal scroll; hero, grid, and footer stack.

## Implementation notes (post-build)

- **`sanityFetch` cannot read this private dataset for page rendering.**
  `next-sanity` `defineLive` only attaches `serverToken` for draft
  perspectives / stega; a normal `published` read is sent unauthenticated and
  returns nothing on a private dataset, so `notFound()` fired for every course.
  Switched the page + `generateMetadata` to `getReadClient().fetch(...)` (the
  token-bearing helper already in `sanity/lib/fetch.ts`, which AGENTS.md
  designates for token reads). `generateStaticParams` already used it.
- Consequence: `/courses/[slug]` renders as **dynamic** (`ƒ`) rather than SSG,
  because the token client sets `useCdn:false`. Reads are wrapped with
  `next: { revalidate: 60, tags: ["course", "course:<slug>"] }` for caching.
- The seeded `nextjs-app-router-in-depth` has 4 modules (not the mock's 12), so
  the "Show all N modules" toggle only appears on courses with >6 modules
  (e.g. `python-for-data-work`). Verified total duration `1h 59m`, `4 modules`,
  `18.2k students`, `Intermediate`, Popular pill, outcomes, sticky footer all
  render from real data; unknown slug → 404; other course slugs → 200.
