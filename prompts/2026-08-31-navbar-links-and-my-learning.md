# Navbar links + minimal My Learning page

## Goal
Make the top navigation actually navigate:
- Clicking the logo / "Skiply" wordmark goes to the homepage (`/`).
- "Courses" goes to `/courses`.
- "My Learning" goes to a new `/my-learning` page (currently the link is a dead `#`).

## Skills / docs read
- `AGENTS.md` §3 (reproduce design, no restyle), §5 (server/client boundaries), §7 (My Learning is presentational only, may read progress for display; gate protected features), §13 (checks).
- `node_modules/next/dist/docs/` — App Router `Link`, server components, `redirect`.

## Code inspected
- `components/ui/Navigation.tsx` — `TopNav` renders `links` (string labels) as `<a href="#">`; `Logo` is not wrapped in a link. `activeLink` highlights a label in `text-primary-500`.
- `components/ui/Logo.tsx` — server component, root `<div className="flex items-center gap-2">`, optional `wordmark`.
- `TopNav` call sites: `app/page.tsx`, `app/courses/page.tsx`, `app/search/page.tsx` (`activeLink="Courses"`), `app/courses/[slug]/page.tsx`, `app/lessons/[slug]/page.tsx`, `app/design-system/page.tsx`.
- `app/courses/page.tsx` — pattern for a catalog page: `getCatalogCourses()` + `auth()`, `<TopNav showActions />`, `Container`, `CourseGrid`.
- `components/course/CourseGrid.tsx` — takes `CATALOG_COURSES_QUERY_RESULT`, each card links to `/courses/<slug>`.
- `components/course/CourseProgressBar.tsx` — documents that per-learner progress has **no backend yet**; uses a static placeholder.
- `proxy.ts` — `clerkMiddleware()` with no route protection; gating is done per-page.
- No `/my-learning` route exists; no progress store or progress API route exists (`app/api` only has `search`).

## Decisions & assumptions
- **Nav links stay label-driven** (no call-site changes). Add a label→href lookup in `Navigation.tsx`:
  `{ "Courses": "/courses", "My Learning": "/my-learning" }`. Unknown labels fall back to `"#"`.
  Swap `<a>` for `next/link` `Link`.
- **Logo** becomes a `Link`. Add `href?: string` prop defaulting to `"/"`. Root element becomes
  `<Link href={href} className={cn("flex items-center gap-2", className)}>`. Works in the design-system
  showcase too (clicking it just navigates home); acceptable, no visual change.
- **`/my-learning` is presentational only** (AGENTS.md §7). Since there is no progress backend, it shows
  the learner's courses as "Continue learning" using the existing `CourseGrid` (cards link to course
  detail). A short comment mirrors `CourseProgressBar`'s note that real progress is pending.
- **Gate it**: My Learning is per-learner, so require sign-in. `const { userId } = await auth();
  if (!userId) redirect("/sign-in");` — consistent with per-page gating (middleware stays open).
- Pass `activeLink="My Learning"` on the new page's `TopNav`, and add `activeLink="Courses"` to
  `app/courses/page.tsx` for consistency with the search page.
- No new PostHog event — My Learning is not in the §7 instrumentation list.

## Files to touch
- `components/ui/Navigation.tsx` — label→href map, use `Link`.
- `components/ui/Logo.tsx` — wrap in `Link`, add `href` prop.
- `app/my-learning/page.tsx` — **new**, presentational, auth-gated.
- `app/courses/page.tsx` — add `activeLink="Courses"`.

## Requirements
- Logo and both nav links navigate with client-side `Link`.
- Active link styling unchanged (`text-primary-500` for the matching label).
- `/my-learning` renders under `TopNav`, matches the existing catalog page layout/spacing, is responsive.
- Signed-out visit to `/my-learning` redirects to `/sign-in`.
- No design/visual changes to the navbar beyond making it clickable.

## Security considerations
- No tokens or secrets touched. Sanity reads stay server-side via `getCatalogCourses()`.
- `/my-learning` gated with Clerk `auth()` on the server; no client-side gating.

## Acceptance criteria
- Click "Skiply"/logo from any page → lands on `/`.
- Click "Courses" → `/courses`; "My Learning" → `/my-learning`.
- `/my-learning` while signed out → redirected to sign-in.
- `/my-learning` while signed in → heading "My Learning" + course cards, no console errors.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.

## Checks to run (web workspace)
1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run build` (new route + component changes)
4. `npm run dev` and manually test.

## Manual test steps
1. `npm run dev`, open `http://localhost:3000`.
2. From the homepage, click the "Skiply" logo — page stays on `/` (no reload flash).
3. Go to `/courses`, click the logo — back to `/`.
4. Click "Courses" in the navbar — lands on `/courses`, "Courses" shown in primary color.
5. Click "My Learning" — lands on `/my-learning`.
6. Sign out, visit `/my-learning` directly — redirected to the sign-in page.
7. Sign in, visit `/my-learning` — see "My Learning" heading and course cards; click a card → course detail page.
8. Resize to mobile width — navbar and My Learning grid stack sensibly, desktop layout unchanged.
