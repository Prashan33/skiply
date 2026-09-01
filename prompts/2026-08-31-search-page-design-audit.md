# Search results page — design audit & gap fixes

## Goal

The intelligent search page (`/search`) already exists (commit `65e78c9`, prompt
`prompts/2026-08-30-search.md`). This task does **not** rebuild it. It audits the
built page against `design/vertex-search.png` and closes the visual/wiring gaps
found, without changing the search architecture (Context MCP route, grounded
slug-join, Zod contract, PostHog events all stay as-is).

## Skills / references read

- `AGENTS.md` §3 (reproduce the reference exactly, reuse existing components,
  make it responsive to mobile), §7 & §11 (search behaviour — unchanged here),
  §12 (MCP needs a deployed Studio; env rules), §13 (checks).
- `design/vertex-search.png` — the source of truth for this page.
- `app/design-system/page.tsx` — type scale (Playfair = Display only; **Inter =
  all Headings incl. "Card titles"**), colour tokens, radius/shadow tokens.
- Existing code inspected: `app/search/page.tsx`, `app/api/search/route.ts`,
  `components/search/{SearchResults,ResultCard,SearchLauncher}.tsx`,
  `lib/search.ts`, `lib/format.ts`, `lib/video.ts`, `sanity/lib/{queries,fetch}.ts`,
  `components/ui/{Badge,Input,Select,Navigation,Container,Button,Logo}.tsx`,
  `components/ui/Card.tsx`, `app/globals.css`, `app/layout.tsx`.

## Findings (built page vs. design)

### Visual gaps to fix

1. **Result-card titles render in Playfair serif.**
   `ResultCard` uses `font-display text-heading-3` for the `<h3>`. The design
   system says card titles are Inter, and every sibling card
   (`Card.tsx`, `LearnGrid.tsx`) uses `text-heading-3 font-medium text-neutral-900`.
   → Drop `font-display`; use `text-heading-3 font-medium text-neutral-900`.

2. **LESSON badge is orange; design shows violet.**
   Design: VIDEO tag = pale-orange bg / orange text; LESSON tag = pale-violet bg
   / violet text. `ResultCard` currently renders both with `variant="lesson"`
   (orange).
   → Add accent tokens to `app/globals.css`
   (`--color-accent-100: #ede9fe; --color-accent-600: #7c3aed;` + the matching
   `@theme inline` lines) and two **new** non-breaking `Badge` variants:
   `videoTag` (`bg-primary-100 text-primary-500`) and
   `lessonTag` (`bg-accent-100 text-accent-600`). Use them in `ResultCard`.
   Do **not** modify the existing `video` / `lesson` / `popular` variants —
   they are used by `Card.tsx`, the lesson page, `CourseContent`, and the
   design-system showcase.

3. **Lesson-kind card meta row shows too much.**
   Design lesson cards show a single plain `Module 5` line under the description
   (no icons, no "Lesson N.M"). `ResultCard` currently shows
   `FileText lessonLabel` + `Folder moduleLabel` for both kinds.
   → For `kind === "lesson"`: render only `result.moduleLabel` as
   `text-small text-neutral-500`, no icons.
   → For `kind === "video"`: keep the existing
   `FileText {lessonLabel}` + `Folder {moduleTitle}` row (matches design).

4. **Key-points panel: orange bullets + outline check.**
   Design: neutral/gray bullet dots and a **filled dark circular** check
   bottom-right.
   → Bullet dot: `bg-neutral-300` (was `bg-primary-500`).
   → Replace the outline `CheckCircle2` with a filled mark:
   `<span class="… h-5 w-5 rounded-full bg-neutral-900 …"><Check class="h-3 w-3 text-white" /></span>`.
   Keep the "presentational only" comment (progress has no backend — AGENTS §7).

5. **Course monogram tile is solid dark.**
   Design shows a light tile with a hairline border and a dark glyph.
   → `CourseRow` tile: `bg-white border border-neutral-200 text-neutral-900`
   (keep `h-6 w-6`, `rounded-[var(--radius-xs)]`, `text-[11px] font-semibold`).

6. **Bottom-CTA button (and error-state button) are solid orange.**
   Design: white bg, orange text, orange border, trailing **arrow** (`ArrowRight`,
   not `ChevronRight`).
   → In `SearchResults`, replace the `PRIMARY_LINK` constant with a secondary
   style: `… bg-white text-primary-500 border border-primary-500 hover:bg-primary-100 …`
   and swap the icon to `ArrowRight`. Applies to both the empty/error CTA and the
   bottom CTA.

7. **"Sort by" label is visible on desktop.**
   Design shows only the select. → Make the label always `sr-only`
   (drop `sm:not-sr-only`).

8. **Logo says "Skiply" with an "S" tile.**
   Design shows the **Vertex** wordmark with a downward-chevron mark.
   → Update `components/ui/Logo.tsx`: mark = inline SVG downward chevron in
   `--color-primary-500`; wordmark text = `Vertex`. (This is a shared component —
   it changes every page's header. That is correct: the product is "Vertex"
   per AGENTS.md §1. See "Needs your attention".)
   → `app/search/page.tsx` `generateMetadata`: `— Skiply` → `— Vertex`.

9. **Nav "Courses" link is not shown active.**
   Design highlights "Courses" in primary orange.
   → Add an optional `activeLink?: string` prop to `TopNav` (default `undefined`,
   existing behaviour unchanged); when a link matches, render it
   `text-primary-500` instead of `text-neutral-700`. Pass `activeLink="Courses"`
   from `app/search/page.tsx`. Leave the `href="#"` placeholders as-is (routing
   is out of scope).

### Spacing / responsive polish (low-risk, match the reference)

10. `ResultCard`: outer padding `p-4` → `p-5`; media↔text gap `gap-4` → `gap-5`;
    media width `sm:w-60` → `sm:w-64`. (Matches sibling `LessonCard` padding and
    the reference proportions.)
11. `SearchResults` h1: `text-display-1` → `text-display-2 sm:text-display-1`
    so the 48px title doesn't overflow on narrow screens.
12. `Input` shortcut hint passed by `SearchResults`/`SearchLauncher`:
    `"⌘K"` → `"⌘ K"` (matches the spaced glyph in the design). One-character
    change in both call sites; do not change the `Input` component.

### Explicitly NOT changing

- Search route / MCP wiring / system prompt / `searchResponseSchema` /
  grounded slug-join / sort logic / PostHog events / `getSearchIndex` query.
- Page background stays `bg-neutral-50` (consistent with home & catalog; the
  warm cast in the mock is mockup canvas).
- Existing `Badge` variants, `Button`, other pages.

## Files expected to touch

- `app/globals.css` — add `--color-accent-100` / `--color-accent-600` tokens.
- `components/ui/Badge.tsx` — add `videoTag`, `lessonTag` variants.
- `components/ui/Logo.tsx` — Vertex mark + wordmark.
- `components/ui/Navigation.tsx` — optional `activeLink` prop on `TopNav`.
- `components/search/ResultCard.tsx` — items 1, 3, 4, 5, 10.
- `components/search/SearchResults.tsx` — items 6, 7, 11, 12; `activeLink` wiring is in the page.
- `components/search/SearchLauncher.tsx` — item 12.
- `app/search/page.tsx` — `activeLink="Courses"`, metadata "Vertex".
- `app/design-system/page.tsx` — add the two new badge variants to the section 09
  showcase (keeps the design-system page a complete reference). Optional but
  preferred.

## Security considerations

- No change to trust boundaries. No token, MCP URL, or model call moves toward
  the client. `Badge`/`Logo`/`ResultCard` stay presentational. `lib/search.ts`
  stays pure (no `server-only`, no secrets).

## Acceptance criteria

- `/search?q=data%20fetching` matches `design/vertex-search.png`: Vertex logo,
  active "Courses", serif page title with the query in orange, "Found N results
  across M courses", ⌘ K search box, `N results` + bare sort select, VIDEO cards
  (orange tag, thumbnail + play + duration, `Lesson N.M` + module title,
  "Watch from mm:ss") and LESSON cards (violet tag, gray key-point panel + filled
  dark check, `Module N`, "View lesson"), secondary-style bottom CTA with arrow.
- Card titles are Inter (sans), not serif.
- Empty state and error state still render; error CTA is the secondary style.
- Responsive: at 375px the layout stacks (media above text), no horizontal
  scroll, the h1 does not clip.
- No new client exposure of secrets.

## Checks to run (AGENTS §13, web workspace)

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` (component + page changes)
- `npm run dev`, load `/search?q=data%20fetching`, eyeball against the PNG at
  1440px and 375px.

## Manual test steps

1. `npm run dev`.
2. Open `http://localhost:3000/search?q=data%20fetching`.
3. If search is configured (see "Needs your attention"), confirm result cards
   render and match the design. If not, confirm the header, search box, sort
   toolbar, empty/error state, and bottom CTA still match the design shell.
4. Click a VIDEO card → lands on `/lessons/<slug>?t=<seconds>` (or no `t` when
   `startSeconds` is 0). Click a LESSON card → `/lessons/<slug>`.
5. Press ⌘K / Ctrl-K → search box focuses and selects.
6. Change the sort select → order updates; "Most Relevant" is the default.
7. Resize to 375px → cards stack, no horizontal scroll, title not clipped.
8. Check any other page (`/`, `/courses`) → header now shows the Vertex logo and
   nothing else regressed.

## Needs your attention (cannot be done in code here)

- **Search returns the error state until env is fixed.** `.env.local` has
  `OPEN_API_KEY` (typo) but `app/api/search/route.ts` reads `OPENAI_API_KEY`, and
  `SANITY_CONTEXT_MCP_URL` is not set. Rename the var and set the MCP URL to the
  base from `.env.example` **plus** the deployed config-doc slug
  (`…/context/mcp/g178ibto/production/vertex-search`).
- The Context MCP only serves a dataset with a **deployed Studio app**
  (AGENTS §12) and the imported `vertex-search` context document. Verify both.
- Updating `Logo` rebrands every page's header to "Vertex". `package.json`
  `name` is still `skiply` and `app/layout.tsx` `metadata.title` is still
  `"Skiply"` — say the word if you want a full repo-wide rename as a separate
  change.
