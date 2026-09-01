# Gate video playback and search behind sign-in

## Goal

Browsing stays public. Two actions now require a signed-in user:

1. **Playing a lesson video** — the lesson page is still viewable (title, notes,
   key points, resources), but the video area shows a "Sign in to watch" gate
   until the user authenticates.
2. **Search ("ask anything")** — `/search` and `POST /api/search` require auth.
   A signed-out user who submits the hero search box is sent to sign-in.

Everything else (`/`, `/courses`, `/courses/[slug]`, instructor pages) stays
open. `/my-learning` already requires auth and keeps doing so.

## Skills read

- None new. This is Clerk middleware + component gating following patterns
  already in the repo (`proxy.ts`, `components/ui/Navigation.tsx` using
  `SignInButton`/`Show`, `app/my-learning/page.tsx` using `auth()` + `redirect`).
- `AGENTS.md §5` — "gate only what a feature marks as protected", protection
  lives in middleware, not client code.

## Code inspected

- `proxy.ts` — Next 16's middleware file. Currently bare `clerkMiddleware()`,
  matcher already covers pages + `/(api|trpc)(.*)`. Nothing is protected today.
- `app/api/search/route.ts` — calls `await auth()` only to get `distinctId` for
  PostHog; anonymous is allowed (`userId ?? "anonymous"`).
- `app/lessons/[slug]/page.tsx` — server component, already does
  `const [lesson, { userId }] = await Promise.all([...])`. Renders `<LessonVideo>`
  unconditionally. `poster` (`{ url, alt }` or null) and `monogram` are already
  computed above the JSX.
- `components/lesson/LessonVideo.tsx` — client. Has a "Video unavailable"
  fallback block whose styling (aspect-video, rounded, `bg-neutral-900`, poster
  `Image` with `object-cover opacity-60`, centered monogram) the gate should
  mirror.
- `app/search/page.tsx` — server component, no auth check. Renders `<TopNav>` +
  `<SearchResults>`.
- `components/search/SearchResults.tsx` — client, calls `/api/search` via
  `useObject({ api: "/api/search" })`.
- `components/ui/Navigation.tsx` — already renders `SignInButton mode="modal"` /
  `SignUpButton mode="modal"` for signed-out users via `<Show when="signed-out">`.
- `app/sign-in/[[...sign-in]]/page.tsx` — Clerk `<SignIn />` at `/sign-in`.

## Decisions / assumptions

- **Lesson video is gated in-page, not by route.** The user said "let them go
  into courses … while they want to play a video … they have to sign in", so the
  lesson page stays reachable and only the player is replaced. Notes/key points/
  resources remain readable signed-out.
- **Search is gated at the route** via `auth.protect()` in `proxy.ts` for
  `/search(.*)`. A signed-out submit of the hero box navigates to `/search?q=…`
  and Clerk redirects to `/sign-in` with a return URL. Simple, no UI change to
  the search box needed.
- **`/api/search` also hard-rejects anon** with `401` (defense in depth, in case
  the endpoint is hit directly). Middleware already matches `/api/*` but we do an
  explicit check in the handler rather than `auth.protect()` so the response is a
  clean JSON 401, not a redirect.
- **`/my-learning` added to the protected matcher** too, for consistency; its
  in-page `redirect("/sign-in")` stays as a belt-and-suspenders fallback.
- **Post-sign-in refresh.** The gate is a client component. After a modal
  sign-in it watches `useAuth().isSignedIn`; when it flips true it calls
  `router.refresh()` so the server component re-renders with the real
  `<LessonVideo>`. No full page reload.
- Keep `mode="modal"` for the gate's buttons, matching the navbar, so the user
  stays on the lesson page.
- No design reference for the gate — reuse the existing "Video unavailable"
  frame styling and the navbar's button styles. Do not invent new visuals.

## Files to touch

- `proxy.ts` — add `createRouteMatcher(["/search(.*)", "/my-learning(.*)"])`;
  in the `clerkMiddleware(async (auth, req) => { … })` callback call
  `await auth.protect()` when matched.
- `app/api/search/route.ts` — after `const { userId } = await auth();` add
  `if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });`
  (before the PostHog capture / MCP work).
- `components/lesson/LessonVideoGate.tsx` — **new** client component. Props:
  `poster: { url: string; alt: string } | null`, `monogram: string`,
  `title: string`. Renders the aspect-video frame with the blurred/dimmed poster
  (or monogram fallback), a lock icon (`lucide-react` `Lock`), a short line
  ("Sign in to watch this lesson"), and `SignInButton` + `SignUpButton`
  (`mode="modal"`) styled like the navbar. Uses `useAuth()` + `useRouter()` to
  `router.refresh()` once `isSignedIn` becomes true.
- `app/lessons/[slug]/page.tsx` — where `<LessonVideo … />` is rendered, branch:
  `userId ? <LessonVideo … /> : <LessonVideoGate poster={poster} monogram={monogram} title={lesson.title ?? "Lesson video"} />`.
- `components/search/SearchResults.tsx` — minor: if the `useObject` `error` is a
  401, show a "Please sign in to search" message instead of the generic error.
  (Reachable only if middleware is bypassed; cheap safety.)

## Requirements

- Signed-out: `/`, `/courses`, `/courses/[slug]`, instructor pages, and
  `/lessons/[slug]` all render 200 with content.
- Signed-out on `/lessons/[slug]`: no `<iframe>` in the DOM; the gate CTA is
  shown; notes/key points/resources still render.
- Signed-out navigating to `/search` (or submitting the hero box): redirected to
  `/sign-in`.
- Signed-out `POST /api/search`: `401`, no OpenAI or MCP call made.
- Signed-in: lesson video plays as before; search works as before; progress and
  bookmarks unaffected.
- After signing in via the lesson-page modal, the video appears without a manual
  page reload.

## Security considerations

- Protection is in middleware (`proxy.ts`), not client-only. The in-page gate is
  UX; the API 401 is the real control for search.
- No token or key exposure changes. `/api/search` still never runs for anon, so
  the OpenAI key and MCP URL are not exercised by unauthenticated traffic.
- The lesson `videoUrl` is public data already (course pages list lessons); the
  gate is a product decision, not a secrecy boundary. Acceptable — matches the
  request.

## Acceptance criteria

- [ ] `proxy.ts` protects `/search(.*)` and `/my-learning(.*)`; everything else
      stays public.
- [ ] `POST /api/search` returns `401` for anon and does no downstream work.
- [ ] `/lessons/[slug]` signed-out: gate shown, no iframe, notes visible.
- [ ] `/lessons/[slug]` signed-in: unchanged behaviour.
- [ ] Hero search box while signed-out → sign-in flow.
- [ ] Signing in from the lesson gate reveals the player without a hard reload.
- [ ] `npm run lint` and `npx tsc --noEmit` clean.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` (middleware + route + page changes)
- Manual (below) against `npm run dev`.

## Manual test steps

1. `npm run dev`. In a signed-out browser (or incognito):
   1. Visit `/courses` → loads. Open a course → loads. Open a lesson → page
      loads, video area shows "Sign in to watch", notes/key points show.
   2. View source / devtools: confirm no `<iframe>` on the lesson page.
   3. From the homepage, type in "Ask anything…" and submit → you land on
      `/sign-in` (with a return URL back to `/search`).
   4. `curl -X POST http://localhost:3000/api/search -H 'content-type: application/json' -d '{"query":"agent loop"}'`
      → `401 {"error":"unauthorized"}`.
2. Sign in:
   1. On a lesson page, click "Sign in" in the gate, complete the modal → the
      video player appears in place, no manual refresh.
   2. Play the video → still tracks progress; complete threshold still marks the
      lesson done.
   3. Search "agent loop" → results stream, deep-link timestamp works.
   4. `/my-learning` loads.
3. Regression: signed-in course/catalog pages, bookmarks, resume affordance all
   behave as before.
