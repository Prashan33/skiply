Date: 2026-08-30

## Prompt

> can you add images for the all courses, use images whatever you like instead
> of just the letter.

## Goal

Course cards (homepage "All Courses" + `/courses`) show a real cover image
instead of the monogram-letter tile.

## Code inspected

- Seed data: every `course.coverImage` resolved to a real Sanity CDN asset
  (`cdn.sanity.io/images/g178ibto/production/...-1600x900.jpg`, 16:9). Verified
  via GROQ `defined(coverImage.asset)` → true for all 10.
- `CATALOG_COURSES_QUERY` already returns `coverImage { asset, hotspot, crop,
  alt }` — no query change.
- `components/ui/Card.tsx` `CourseCard` — `p-5` card, `h-10 w-10` icon tile,
  title, description, meta row. Used in `components/course/CourseGrid.tsx` and
  `app/design-system/page.tsx` (showcase, passes `icon`).
- `sanity/lib/image.ts` — `urlFor()` builder already set up.
- `next.config.ts` — no `images` config yet.

## Decisions & assumptions

1. **`CourseCard` gets an optional `image?: { url: string; alt: string }`.**
   - When `image` is set: render a full-bleed 16:9 `next/image` header
     (`fill`, `object-cover`, rounded top), and **omit** the icon tile.
   - When `image` is absent: unchanged (icon tile) — keeps the design-system
     showcase working without edits.
   - `icon` prop becomes optional.
2. **`CourseGrid`** builds the URL with
   `urlFor(course.coverImage).width(800).height(450).fit("crop").auto("format").url()`
   and passes `{ url, alt: coverImage.alt || course.title }`. Falls back to the
   monogram (existing behaviour) only if `coverImage`/asset is missing.
3. **`next.config.ts`** — add
   `images.remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }]`.
4. Card body/paddings, meta row, shadow, and the grid layout stay as they are.
   The image sits above the existing `p-5` content block.
5. This is a deliberate deviation from `design/vertex-home.png` (which shows an
   icon tile), made at the user's explicit request.

## Files to touch

- `components/ui/Card.tsx` — add optional `image` to `CourseCard`, render image
  header, make `icon` optional.
- `components/course/CourseGrid.tsx` — build image URL from `coverImage`, pass
  `image`; keep monogram fallback.
- `next.config.ts` — allow `cdn.sanity.io` images.

No query/schema/Studio changes. Uses installed `next`, `@sanity/image-url`.

## Security considerations

- `urlFor` uses only the public projectId/dataset (already client-safe). No
  token involved. Images served from Sanity's CDN over HTTPS.
- `next/image` remote host is pinned to `cdn.sanity.io` only.

## Acceptance criteria

1. Every card on `/` and `/courses` shows its cover image (16:9, cropped, no
   distortion); no monogram letter when an image exists.
2. `next/image` loads the Sanity CDN images (no console errors, no
   "hostname not configured").
3. Card links, meta row, and layout unchanged otherwise.
4. `app/design-system` still renders (icon-tile path intact).
5. `npx tsc --noEmit`, `npm run lint`, `npm run build` pass.

## Checks to run

- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Dev server on :3000 — load `/` and `/courses`, confirm images render.

## Manual test steps

1. `http://localhost:3000/` → 3 cards, each with a photo header.
2. `http://localhost:3000/courses` → 10 cards with photo headers.
3. Click a card → correct `/courses/<slug>`.
4. `http://localhost:3000/design-system` → CourseCard sample still shows its
   icon tile.
