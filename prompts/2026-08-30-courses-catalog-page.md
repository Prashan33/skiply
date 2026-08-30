Date: 2026-08-30

## Prompt

> can you do like 3 in the main page and when we go to view all courses, then we
> can see all the courses listed

## Goal

- Homepage "All Courses" grid shows only the first 3 seeded courses.
- "View all courses" links to a new `/courses` page that lists every seeded
  course.

## Code inspected

- `app/page.tsx` — now async, fetches `CATALOG_COURSES_QUERY` via
  `getReadClient()`, maps each course into `CourseCard` wrapped in a `Link` to
  `/courses/<slug>`. "View all courses" is a dead `<a href="#">`.
- `app/courses/[slug]/page.tsx` — the course detail route already exists, so the
  catalog index is `app/courses/page.tsx`.
- `components/ui/Card.tsx` `CourseCard`, `components/ui/Container.tsx`,
  `components/ui/Navigation.tsx` (`TopNav`), `lib/format.ts`
  (`formatDurationFromSeconds`, `capitalize`).
- No design image exists for a catalog page (`design/` has home, course, lesson,
  search, design-system only). Reuse the homepage card grid verbatim — same
  components, spacing, and monogram icon treatment. No new visual design.

## Decisions & assumptions

1. **Extract a shared grid** `components/course/CourseGrid.tsx` (server
   component) that takes `courses: CATALOG_COURSES_QUERY_RESULT` and renders the
   existing `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` of `CourseCard`s,
   each wrapped in a `Link` to `/courses/<slug>` (monogram icon from title,
   `capitalize(level)`, `formatDurationFromSeconds`, `N modules`). Both
   `app/page.tsx` and `app/courses/page.tsx` use it — removes duplication.
2. **Homepage:** slice the fetched list to 3 (`courses.slice(0, 3)`) before
   passing to `CourseGrid`. Ordering unchanged (`popular desc, title asc` from
   the query). Change "View all courses" from `<a href="#">` to
   `<Link href="/courses">` (keep the same styling/arrow).
3. **New `app/courses/page.tsx`** (async server component):
   - `TopNav showActions`, `Container`, `bg-neutral-50`, matching the homepage
     shell.
   - Breadcrumb: `All Courses` (current page, `text-neutral-900`).
   - Heading `All Courses` (`font-display text-heading-1`) with a count on the
     right: `${courses.length} courses` (`text-body text-neutral-500`), same
     header layout as the homepage section.
   - `<CourseGrid courses={courses} />` with all seeded courses.
   - `generateMetadata` → `title: "All Courses — Skiply"`.
   - Fetch with the same `getReadClient().fetch(CATALOG_COURSES_QUERY, {}, {
     next: { revalidate: 60, tags: ["course"] }})` helper.
4. Empty result → render the header with an empty grid (no crash). Seed has 10.
5. `/courses` will be dynamic (`ƒ`) for the same private-token reason as the
   other content routes.

## Files to touch

- `components/course/CourseGrid.tsx` — new.
- `app/courses/page.tsx` — new.
- `app/page.tsx` — use `CourseGrid`, slice to 3, `Link` the "View all courses".

No query, schema, or Studio changes. No new deps.

## Security considerations

- Reads via `getReadClient()` (server-only token). Both pages stay Server
  Components. No token or client in the browser. No user input.

## Acceptance criteria

1. Homepage shows exactly 3 course cards; "View all courses" navigates to
   `/courses`.
2. `/courses` lists all 10 seeded courses in the same card style, with a
   `10 courses` count, each card linking to `/courses/<slug>`.
3. `npx tsc --noEmit`, `npm run lint`, `npm run build` pass.
4. Homepage card style/layout visually unchanged.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Dev server already running on :3000 — curl `/` (3 cards) and `/courses`
  (10 cards, count).

## Manual test steps

1. Open `http://localhost:3000/` → "All Courses" shows 3 cards.
2. Click "View all courses" → `/courses` with all 10, header count `10 courses`.
3. Click a card on either page → correct `/courses/<slug>`.
4. Homepage hero and skyline unchanged.
