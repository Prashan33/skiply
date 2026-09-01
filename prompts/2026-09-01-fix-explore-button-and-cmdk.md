# Fix the "Explore Courses" button and ⌘K on the homepage

Two pre-existing dead controls (not caused by the auth gating work).

## Bugs

1. **`app/page.tsx` "Explore Courses"** is a bare `<Button>` — no `onClick`, no
   `href`. Clicking it does nothing. It should navigate to `/courses`.
2. **⌘K on the homepage does nothing.** The `⌘ K` hint is rendered by
   `SearchLauncher` (via `Input`'s `shortcut` prop), but the keydown handler for
   it lives only in `components/search/SearchResults.tsx` (the `/search` page).
   The hero box on `/` has no handler.

## Code inspected

- `app/page.tsx:44-47` — the `<Button variant="primary" className="mb-10">Explore Courses …</Button>`.
- `components/ui/Button.tsx` — plain `<button>`, no `asChild` / link support.
- `components/search/SearchLauncher.tsx` — client, `useState` + `router.push`,
  renders `<Input shortcut="⌘ K" … />`, no ref, no key handler.
- `components/ui/Input.tsx` — `forwardRef` to the `<input>`. Ref works.
- `components/search/SearchResults.tsx:114-125` — the reference ⌘K handler:
  `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"` → `preventDefault`,
  `focus()` + `select()`.

## Changes

- **`app/page.tsx`** — render the CTA as a `Link` to `/courses` with the primary
  button styling (Button has no `asChild`, and `<a><button>` is invalid HTML).
  Reuse the same class list Button applies for `variant="primary"`:
  `inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-4 text-body font-medium transition-colors bg-primary-500 text-white hover:bg-primary-400`
  plus the existing `mb-10`. Keep the `ArrowRight` icon child.
- **`components/search/SearchLauncher.tsx`** — add `useRef<HTMLInputElement>(null)`
  passed to `<Input ref={…}>`, and a `useEffect` that registers a
  `window` `keydown` listener matching the SearchResults handler (⌘/Ctrl-K →
  `preventDefault`, focus + select the input). Clean up on unmount.

Nothing else. No design change — the hero already shows the hint and the button;
this only makes them work.

## Acceptance criteria

- [ ] Clicking "Explore Courses" on `/` navigates to `/courses`.
- [ ] Pressing ⌘K (macOS) / Ctrl-K on `/` focuses and selects the hero search
      input; the browser's default (e.g. search-bar focus) is prevented.
- [ ] `npx tsc --noEmit` and `npm run lint` clean.
- [ ] No change to `/search`'s own ⌘K behaviour.

## Checks

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Manual: load `/`, click the button, press ⌘K.
