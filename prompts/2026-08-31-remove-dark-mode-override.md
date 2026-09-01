# Fix invisible (white) text in OS dark mode

## Goal
Text in the search bar (and other spots) renders white-on-light and is unreadable when the
visitor's OS is in dark mode. Make the app render its intended light design regardless of the
OS color-scheme setting.

## Root cause
`app/globals.css` lines 101–106 are the only dark-mode styling in the codebase:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: var(--color-neutral-900);
    --foreground: var(--color-neutral-50);
  }
}
```

`body` uses `color: var(--foreground)`, so in OS dark mode body text becomes near-white. Every
section wrapper still paints a light background (`bg-white` / `bg-neutral-50`), and any text
without an explicit color utility inherits white → invisible. Native form controls also flip to
a dark UA color-scheme. There are no `dark:` variants anywhere else — the app is designed
light-only (AGENTS.md §3: the reference images are the source of truth, no dark mode).

## Decision
- Delete the `@media (prefers-color-scheme: dark)` block in `app/globals.css`.
- Add `color-scheme: light;` to `:root` so native inputs / scrollbars stay light in dark-mode OSes.

## Files to touch
- `app/globals.css` — remove the dark media query, add `color-scheme: light` to `:root`.

## Requirements
- No visual change for light-mode OS users.
- Dark-mode OS users see the same light design; search bar text is dark and readable.

## Security considerations
- None; CSS only.

## Acceptance criteria
- With OS set to dark mode, the homepage hero search and `/search` search box show dark text.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` pass.

## Checks to run (web workspace)
1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run build`

## Manual test steps
1. Set macOS to Dark appearance (System Settings → Appearance).
2. `npm run dev`, open `http://localhost:3000`.
3. Type in the hero search box — text is dark/readable; placeholder is grey.
4. Run a search, land on `/search`, type in that search box — same.
5. Switch macOS to Light appearance — pages look identical to before.
