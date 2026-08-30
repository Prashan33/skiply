Date: 2026-08-29

## Prompt

> @studio/scripts/seed/seed.ndjson @studio/scripts/seed/videos.json seed sanity using the
> provided seed.ndjson and videos.json files instead of generating new content. use the
> sanity cli import, verify the document counts afterward, and do not modify the files.

Clarification (question panel): videos.json is a keyed JSON object, not NDJSON, and there
is no `video` document type yet. User chose **"Transform → import as video docs"**: derive
an NDJSON from videos.json (without touching the source file) and import it too.

---

## Goal

Populate the `g178ibto` / `production` Sanity dataset from the two committed seed files,
using `sanity dataset import`, then verify the resulting document counts. Do not edit
`seed.ndjson` or `videos.json`.

## Skills / docs read

- AGENTS.md §8 (data model — `video` doc holds `id`, `url`, `chapters[]{startSeconds,label}`,
  `chunks[]{startSeconds,text}`), §9 (video keyed by an id derived from the URL, stripping
  chars the datastore rejects in ids), §13 (Studio checks: import content), §14 (don't overbuild).
- `sanity-best-practices` — not re-read; this is an import/ops task, no schema or GROQ changes.

## Code / data inspected

- `studio/scripts/seed/seed.ndjson` — 141 documents, one per line:
  `course` 10, `lesson` 120, `instructor` 5, `category` 6. Fixed `_id`s
  (`course.*`, `lesson.<slug>`, `instructor.*`, `category.*`). `module` / `learningOutcome`
  / `lessonResource` are inline objects, not documents. `lesson.videoUrl` is always
  `https://www.youtube.com/watch?v=<id>`; 120 distinct URLs.
- `studio/scripts/seed/videos.json` — 120 entries keyed by lesson slug →
  `{ id, title, channel, duration, query }`. Keys match the lesson slugs exactly (0 diff
  both ways). Every entry's `id` appears in that lesson's `videoUrl`. All YouTube.
- `studio/.env` → `SANITY_STUDIO_PROJECT_ID=g178ibto`, `SANITY_STUDIO_DATASET=production`.
  Root `.env.local` agrees.
- `sanity debug` → CLI authenticated as prashanadhikari2486@gmail.com on `g178ibto`.
- Current dataset content: none (only 11 `system.group` + 1 `system.retention`). Effectively
  empty, so a clean import.
- No `video` schema type exists (`studio/schemaTypes/index.ts`). Import does not validate
  against the schema, so `video` docs will be created but will not render in Studio until a
  type is added (out of scope; noted below).

## Decisions & assumptions

- **seed.ndjson** is imported verbatim with `sanity dataset import`.
- **videos.json → derived NDJSON** (`video` documents), one per entry:
  ```json
  {"_id":"video.9602Yzvd7ik","_type":"video","id":"9602Yzvd7ik",
   "url":"https://www.youtube.com/watch?v=9602Yzvd7ik","chapters":[],"chunks":[]}
  ```
  - `_id` = `video.<youtube-id>`. YouTube ids are `[A-Za-z0-9_-]` (valid in Sanity ids);
    the `video.` prefix covers ids that start with `-`. 120 entries → 120 distinct ids.
  - `url` is rebuilt as `https://www.youtube.com/watch?v=<id>` so it matches
    `lesson.videoUrl` exactly (AGENTS §7 "lessons link to them by video URL").
  - Fields limited to AGENTS §8's list: `id`, `url`, `chapters`, `chunks`.
    `chapters`/`chunks` are `[]` — the offline ingestion pipeline (§9) fills them later.
    `title` / `channel` / `duration` / `query` are dropped (not in the model; duration
    already lives on the lesson).
- The transform runs from a **scratchpad script** and writes the derived NDJSON to the
  **scratchpad** — nothing is written into `studio/scripts/seed/` and neither source file
  is touched.
- Import mode: `--replace` on both, so re-running is idempotent (seed uses fixed `_id`s).
  `--missing` is not used. No `--allow-assets-outside-dataset` needed (no asset files;
  images in the seed are plain `image` objects without asset refs / `assetId`s → left as-is).
- Assets: seed `image` objects carry no `asset` reference (spot-checked), so there is
  nothing for the importer to upload; if any are present the importer will simply skip them.

## Files expected to touch

- `prompts/2026-08-29-seed-sanity-from-provided-files.md` (this file; result appended after).
- Scratchpad only: a `videos-to-ndjson.mjs` transform + generated `videos.ndjson`.
- **No** repo source files. **No** edits to `seed.ndjson` / `videos.json`. **No** schema changes.

## Requirements

1. Do not modify `studio/scripts/seed/seed.ndjson` or `studio/scripts/seed/videos.json`.
2. Use `sanity dataset import` for both files (run from `studio/`, project `g178ibto`,
   dataset `production`).
3. Derived `video` docs match the shape above and stay within AGENTS §8's field list.
4. Verify document counts after import and report actual numbers.

## Security considerations

- No secrets added or printed. Import auth comes from the already-logged-in CLI session
  (`~/.config/sanity`), not from a token in the repo. The repo's `SANITY_API_READ_TOKEN`
  (Viewer, read-only) is not used and cannot write.
- Writes go to the private `production` dataset only; no client-exposed config changes.

## Acceptance criteria

- `seed.ndjson` and `videos.json` are byte-for-byte unchanged (`git status` clean for them).
- Dataset content-doc counts after import:
  - `course` = 10
  - `lesson` = 120
  - `instructor` = 5
  - `category` = 6
  - `video` = 120
  - total content documents = 261 (system docs excluded)
- Every `video._id` is `video.<lesson videoUrl's ?v= id>`; `video.url` == the matching
  `lesson.videoUrl`; 120/120 lessons resolve to a `video` doc.

## Checks to run

- `git status --porcelain studio/scripts/seed/` → empty (files untouched).
- Post-import GROQ count per `_type` (via `npx sanity documents query`).
- Cross-check: `count(*[_type=="lesson" && !defined(*[_type=="video" && url == ^.videoUrl][0]))])` → 0.

## Manual test steps

1. `cd studio && npx sanity dataset import <scratchpad>/videos.ndjson production --replace`
   then `npx sanity dataset import scripts/seed/seed.ndjson production --replace`
   (order irrelevant; both idempotent).
2. `npx sanity documents query "*[!(_id in path('drafts.**'))]{_type}"` and confirm the
   counts above.
3. In the Studio (`npm run dev` in `studio/`) the catalog shows 10 courses, each course's
   modules list real lessons, instructors and categories are populated. `video` docs won't
   appear (no schema type yet) — expected.

## Needs your attention (post-run)

- `video` documents are schema-less until a `video` type is added to the Studio (AGENTS §8/§9
  work, not part of this task). They exist in the dataset and are query-able now.
- `chapters` / `chunks` are empty; the transcript/chapter ingestion pipeline populates them later.

---

## Result

Imported both files into `g178ibto` / `production` with `sanity dataset import --replace`.

- `seed.ndjson` → 141 documents imported verbatim. The importer also fetched the image
  URLs referenced in the seed and created **135 `sanity.imageAsset`** docs.
- `videos.json` → transformed to 120 `video` NDJSON docs (scratchpad script + output; the
  source file was not touched) and imported.
  - Fix during run: Sanity rejects id elements starting with `-`/`_`. The 3 affected ids
    (`-QVoIxEpFkM`, `-BBulGM6xF0`, `_Q9KSFUZH0c`) get a `yt` prefix on the `_id` element
    only (`video.yt-QVoIxEpFkM`, …); the `id` field and `url` keep the real video id.

Verified counts (GROQ, drafts + `system.*` excluded):

| type | count |
|---|---|
| course | 10 |
| lesson | 120 |
| instructor | 5 |
| category | 6 |
| video | 120 |
| sanity.imageAsset | 135 |

- lessons whose `videoUrl` has no matching `video.url`: **0 / 120**
- videos whose `url` has no matching `lesson.videoUrl`: **0 / 120**
- `git status` for `studio/scripts/seed/`: source files unmodified.
