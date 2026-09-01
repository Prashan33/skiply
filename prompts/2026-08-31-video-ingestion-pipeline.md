Date: 2026-08-31

## Prompt

> implement the offline video ingestion pipeline that builds the video documents with
> timestamped transcript chunks and chapter markers.

Question panel answers:
- **Data source** → *Real fetch + commit a cache*: fetch each YouTube video's caption
  track + chapter markers once, commit the raw result, transform that into `video` docs.
- **Chapter fallback** → *Leave `chapters` empty* when a video has no creator chapters.
  Search then falls back to transcript-chunk matching (AGENTS §7), no synthetic labels.

---

## Goal

Build the offline tooling (AGENTS §9) that populates the 120 existing `video` documents in
`g178ibto` / `production` with:

- `chunks: [{ startSeconds, text }]` — the transcript split into many short, timestamped
  pieces (never one whole-transcript field).
- `chapters: [{ startSeconds, label }]` — the creator's table of contents from YouTube,
  or `[]` when the video has none.

Also add the `video` document type to the Studio (it does not exist yet — the 120 docs were
imported schema-less by the seed step) so authors/agent tooling can see the shape.

Nothing built here runs in the request path.

## Skills / docs read

- AGENTS.md §5 (video pipeline is offline tooling, never in the request path), §7
  (timestamps resolve chapters-first then transcript; playback via provider embed), §8
  (`video` doc = `id`, `url`, `chapters[]{startSeconds,label}`, `chunks[]{startSeconds,text}`;
  never a single field a query returns wholesale), §9 (offline tooling, keyed by an id
  derived from the URL with datastore-rejected chars stripped; per-provider ingestion;
  a provider is not "supported" until ingestion **and** playback exist), §11 (chunks are
  short timestamped pieces; video results always tie to the lesson), §12 (never return a
  whole transcript/chunks array to the model; dataset is private; keys in env), §13
  (Studio checks: schema extract/typegen, import content), §14 (keep it small).
- `sanity-best-practices` — schema: `defineType`/`defineField`, array members need `_key`,
  `readOnly` for pipeline-managed fields, TypeGen via `sanity schemas extract && sanity
  typegen generate`. No GROQ/framework changes here.
- Did **not** re-read Clerk / PostHog / dial-your-context / shape-your-agent — not relevant
  to offline ingestion.

## Code / data inspected

- `studio/scripts/seed/videos.json` — 120 entries keyed by lesson slug →
  `{ id, title, channel, duration, query }`. **All 120 are YouTube.** `id` is the 11-char
  YouTube id; it also appears in the lesson's `videoUrl`
  (`https://www.youtube.com/watch?v=<id>`).
- `studio/scripts/seed/videos-to-ndjson.mjs` — existing transform that produced the 120
  skeleton `video` docs. `_id` convention: `video.<idElement>` where `idElement = /^[A-Za-z0-9]/
  .test(id) ? id : ` + "`yt${id}`" + ` (3 ids start with `-`/`_`). `id`/`url` keep the real
  video id. This convention is **reused verbatim** so the pipeline updates the same docs.
- Dataset today (from the seed prompt result): 120 `video` docs, each
  `{ _id, _type:"video", id, url, chapters:[], chunks:[] }`. Import with `--replace` will
  fill them in place — count stays 120.
- `studio/schemaTypes/index.ts` — no `video` type registered. `studio/structure.ts` — no
  Videos list item. `studio/schemaTypes/documents/lesson.ts` — `duration` (seconds, int) is
  the ceiling for any `startSeconds`.
- `studio/sanity.cli.ts` — `typegen.path` scans `../{app,sanity,components,lib}/**/*` and
  writes `../sanity.types.ts` with `overloadClientMethods`. `npm run typegen` (root) →
  `npm --prefix studio run typegen`.
- `sanity/lib/queries.ts` — no query reads `video` docs yet (search reads them only through
  the Context MCP). Nothing in `app/` / `components/` imports transcript data.
- `app/api/search/route.ts:54` — currently hard-codes *"chapters and chunks are empty …
  always return startSeconds: 0"* and the scope filter excludes `video`. Wiring search to
  use the new data is **out of scope** (separate task) — noted under *Needs your attention*.
- `.env.example` / `.env.local` — only a **Viewer** `SANITY_API_READ_TOKEN` (read-only).
  No write token. The prior seed import wrote via the **authenticated Sanity CLI session**
  (`~/.config/sanity`, user `prashanadhikari2486@gmail.com`), not a repo token. This
  pipeline does the same — **no write token is added to the repo.**
- Verified against live YouTube (unauthenticated):
  - `GET https://www.youtube.com/watch?v=<id>` returns the watch page HTML (~1.4 MB) with a
    `"captionTracks":[{"baseUrl":"…/api/timedtext?…","vssId":".en",…,"kind":"asr"?}]` array.
  - Appending `&fmt=json3` to a `baseUrl` returns `{ events:[{ tStartMs, dDurationMs,
    segs:[{ utf8 }] }] }` — usable cues with millisecond starts.
  - Creator chapters live in `chapteredPlayerBarRenderer.chapters[].chapterRenderer`
    (`title.simpleText` + `timeRangeStartMillis`). Absent when the creator set none.
  - `node_modules` has **no** YouTube/transcript library; Node 20 `fetch` is enough.

## Decisions & assumptions

### 1. `video` schema type (`studio/schemaTypes/documents/video.ts`, new)

```
video (document, icon PlayIcon)
  id        string,  readOnly   — YouTube id (real, unmodified)
  url       url,     readOnly   — https://www.youtube.com/watch?v=<id>
  chapters  array of object { startSeconds: number (int, ≥0), label: string }, readOnly
  chunks    array of object { startSeconds: number (int, ≥0), text: string },  readOnly
  preview: title = url, subtitle = `${chapters} chapters · ${chunks} chunks`
```

- All fields `readOnly` with a description saying the ingestion pipeline manages them —
  they are an internal lookup, not authored in Studio (AGENTS §7/§8).
- Array members are plain inline objects; the transform emits a stable `_key`
  (`ch0…`, `c0…`).
- Register in `studio/schemaTypes/index.ts` (Documents group) and add
  `S.documentTypeListItem('video').title('Videos').icon(PlayIcon)` to `studio/structure.ts`.
- Regenerate types: `npm run typegen` (root). `sanity.types.ts` gains `Video`. No web code
  consumes it yet, so this is additive.

### 2. Fetch stage — `studio/scripts/ingest/fetch-youtube.mjs` (new)

For each entry in `studio/scripts/seed/videos.json`:

1. Skip if `studio/scripts/ingest/cache/<id>.json` already exists, unless `--refresh`
   (idempotent, re-runnable).
2. `GET https://www.youtube.com/watch?v=<id>` (desktop UA, `hl=en`). Retry 3× with
   exponential backoff on non-200 / network error. Sequential with a ~250 ms delay between
   videos (politeness, not a written rule — just avoids hammering).
3. Caption track: from `captionTracks`, pick — **manual English** (`vssId` starts `.en`,
   `kind !== "asr"`) → **auto English** (`kind === "asr"`, English) → **first track**.
   Fetch `baseUrl + "&fmt=json3"`. Map `events` → `cues: [{ startSeconds: tStartMs/1000,
   text: segs.map(s => s.utf8).join("") }]`, dropping cues whose text is blank/`\n`.
   If there is no caption track at all → `cues: []` (recorded, not fatal).
4. Chapters: parse `chapteredPlayerBarRenderer.chapters[].chapterRenderer` →
   `[{ startSeconds: timeRangeStartMillis/1000, label: title.simpleText.trim() }]`.
   Only the creator's `chapteredPlayerBarRenderer` list counts — **not** "most replayed" /
   key-moments markers. None present → `[]`.
5. Write `studio/scripts/ingest/cache/<id>.json` (committed, pretty-printed, stable key
   order):
   ```json
   { "id": "...", "url": "https://www.youtube.com/watch?v=...",
     "fetchedAt": "2026-08-31T...Z",
     "captionKind": "manual" | "asr" | "none",
     "chapters": [{ "startSeconds": 0, "label": "Intro" }],
     "cues": [{ "startSeconds": 0.0, "text": "..." }] }
   ```
6. Print a summary line per video and a final tally (ok / no-captions / failed).

The committed `cache/` dir is the reproducible artifact — the request path never touches
YouTube, and re-deriving docs needs no network.

### 3. Build stage — `studio/scripts/ingest/build-video-ndjson.mjs` (new)

Reads every `cache/*.json`, emits NDJSON `video` docs to **stdout** (redirect to the
scratchpad — the NDJSON is a derived import file, not committed; the cache is the artifact).

- `_id` / `id` / `url`: exact `videos-to-ndjson.mjs` convention (`video.<idElement>`,
  `yt` prefix only on the `_id` element).
- **Chunking** — group cues into short timestamped pieces (AGENTS §8/§9/§11):
  - Accumulate consecutive cues; flush the current chunk when it reaches **≥ 200 chars**
    *or* spans **≥ 18 s** (from first cue start to current cue start).
  - `startSeconds` = `Math.floor(firstCueStart)`; `text` = joined cue text, whitespace
    collapsed, HTML entities decoded (`&amp; &#39; &quot; &lt; &gt;` + numeric), trimmed.
  - Drop empty/whitespace chunks. Result: typically 20–120 word chunks, each < ~260 chars —
    never a whole-transcript blob.
- **Chapters** pass through: `startSeconds` floored to int, `label` trimmed & non-empty,
  sorted ascending, de-duplicated on `startSeconds`.
- Every array member gets `_key` (`c<i>` / `ch<i>`).
- Videos with `cues: []` → `chunks: []` (kept, logged). Videos with `chapters: []` stay `[]`.
- stderr tally: docs emitted, videos with 0 chunks, chunk-count / chapter-count histograms,
  and any chunk `text` > 400 chars or `startSeconds` > the matching lesson `duration`
  (sanity flags, not failures).

### 4. Orchestrator — `studio/scripts/ingest/ingest.mjs` (new)

Runs fetch → build, writes NDJSON to a path given by `--out`, and prints the exact
`sanity dataset import … --replace` command. `--import` runs it via `npx sanity` from
`studio/` (CLI auth). Header comment documents usage, matching the existing seed-script
style. No orchestration magic beyond that.

### 5. Scope / non-goals

- **YouTube only.** All 120 videos are YouTube. Vimeo/Bunny ingestion is **not** built —
  there are no Vimeo/Bunny sources here and AGENTS §9 says don't claim a provider until it
  has both ingestion and playback. Noted under *Needs your attention*.
- **Search is not rewired.** `app/api/search/route.ts` still says startSeconds 0 and
  excludes `video` scope. Enabling chapter/transcript timestamp matching is a follow-up.
- No new npm dependencies. Plain Node 20 `.mjs`, built-in `fetch`.
- No write token in the repo; import uses the logged-in Sanity CLI session.

## Files expected to touch

**New**
- `studio/schemaTypes/documents/video.ts`
- `studio/scripts/ingest/fetch-youtube.mjs`
- `studio/scripts/ingest/build-video-ndjson.mjs`
- `studio/scripts/ingest/ingest.mjs`
- `studio/scripts/ingest/README.md` (short: what it does, how to run, that `cache/` is the
  committed artifact)
- `studio/scripts/ingest/cache/<id>.json` × 120 (committed)

**Edited**
- `studio/schemaTypes/index.ts` (register `video`)
- `studio/structure.ts` (Videos list item)
- `sanity.types.ts` (regenerated by `npm run typegen`)
- `prompts/2026-08-31-video-ingestion-pipeline.md` (this file; result appended)

**Not touched**
- `studio/scripts/seed/*` (videos.json, seed.ndjson, videos-to-ndjson.mjs all unchanged)
- `app/**`, `components/**`, `lib/**`, `sanity/lib/**`
- any `.env*` file

## Requirements

1. Add a `video` document type matching AGENTS §8 exactly (`id`, `url`, `chapters[]{
   startSeconds, label }`, `chunks[]{ startSeconds, text }`), registered in the schema and
   the Studio structure, `readOnly` (pipeline-managed).
2. Offline fetch stage pulls each YouTube video's caption track + creator chapters and
   commits the raw result under `studio/scripts/ingest/cache/`. Re-runnable / idempotent;
   `--refresh` re-fetches.
3. Build stage transforms the cache into `video` NDJSON docs: transcript as many short
   timestamped `chunks`, chapters as `{ startSeconds, label }` or `[]`. No whole-transcript
   field. Reuses the existing `_id` convention so the 120 docs update in place.
4. Import via `sanity dataset import … --replace` using CLI auth. Video doc count stays 120.
5. Nothing here is importable by the web app or Studio runtime — scripts only, run manually.
6. No new npm deps. No secrets added or logged.
7. `npm run typegen` (studio) and web `lint` + typecheck pass; production build passes.

## Security considerations

- YouTube requests are unauthenticated GETs of public pages; cache files hold only public
  transcript text + chapter labels. No credentials involved.
- Sanity writes go through the already-authenticated CLI session, to the private
  `production` dataset only. **No write token is added to the repo or env**; the Viewer
  `SANITY_API_READ_TOKEN` is untouched and cannot write.
- No client-exposed config changes; `video` docs stay an internal lookup (AGENTS §7/§12) —
  no new public query reads them.
- Scripts live under `studio/scripts/ingest/` and are never imported by app/Studio code, so
  no network calls can reach a request path.

## Acceptance criteria

- `video` type present in `studio/schemaTypes/index.ts` + `studio/structure.ts`; opens in
  Studio; `sanity.types.ts` contains a `Video` type after `npm run typegen`.
- `studio/scripts/ingest/cache/` has one committed JSON per `videos.json` entry (120),
  each with `chapters` and `cues` arrays and a `captionKind`.
- After `sanity dataset import --replace`:
  - `count(*[_type == "video"])` == **120** (updated in place, no duplicates).
  - `count(*[_type == "video" && count(chunks) > 0])` == 120 minus the (reported) set of
    videos whose captions are disabled on YouTube.
  - Every `chunks[].text` is non-empty, whitespace-normalized, and < ~400 chars; no field
    holds the full transcript.
  - `chunks` and `chapters` are each sorted ascending by `startSeconds`; every
    `startSeconds` is an integer ≥ 0.
  - `chapters` is populated for videos that have creator chapters on YouTube and `[]` for
    those that don't (spot-check ≥ 3 of each).
- No new entries in `package.json` / `package-lock.json`; `git diff` touches only the files
  listed above.

## Checks to run

- `cd studio && npm run typegen` → schema extract + TypeGen succeed; `Video` in
  `../sanity.types.ts`.
- Root: `npm run lint` and `npx tsc --noEmit` → clean.
- Root: `npm run build` → succeeds (generated types are broadly imported).
- Pipeline verification (Sanity Vision or `npx sanity documents query` from `studio/`):
  - per-`_type` counts (video still 120);
  - `*[_type=="video"]{ "chunks": count(chunks), "chapters": count(chapters) }` histogram;
  - `*[_type=="video" && count(chunks)==0]{ id }` matches the fetch stage's "no captions"
    list;
  - spot-check one doc: chunks short + sorted, chapter labels clean.
- `git status --porcelain studio/scripts/seed/` → empty.

## Manual test steps

1. `cd studio && node scripts/ingest/fetch-youtube.mjs --only 9602Yzvd7ik,VBlSe8tvg4U`
   → writes `scripts/ingest/cache/9602Yzvd7ik.json` and `…/VBlSe8tvg4U.json`. Open them:
   `cues` cover the video, `VBlSe8tvg4U` has real `chapters`, timestamps look sane.
2. `node scripts/ingest/fetch-youtube.mjs` → fetches the remaining ~118 (skips the 2
   cached). Re-run → all skipped (idempotent). Note the final ok/no-caption/failed tally.
3. `node scripts/ingest/build-video-ndjson.mjs > "$SCRATCH/video-docs.ndjson"` → inspect:
   ~120 lines, each `chunks` an array of short `{ _key, startSeconds, text }`, `chapters`
   present or `[]`. Check the stderr histograms.
4. `npx sanity dataset import "$SCRATCH/video-docs.ndjson" production --replace` → reports
   120 documents changed.
5. `npx sanity documents query '*[_type=="video"][0...3]{ id, chapters, "n": count(chunks),
   "first": chunks[0] }'` → chunks/chapters populated.
6. `npm run dev` in `studio/` → **Videos** list shows 120; open one → chapters + chunks
   render (read-only). Open the matching lesson → unchanged.
7. Root `npm run lint && npx tsc --noEmit && npm run build` → all pass.

## Needs your attention (after run)

- **Search still ignores timestamps.** `app/api/search/route.ts` hard-codes
  `startSeconds: 0` and excludes `video` scope. A follow-up task should update the inline
  system prompt + the Context document to do chapters-first / transcript-fallback matching
  now that the data exists.
- **YouTube only.** Vimeo/Bunny ingestion is not implemented (no such sources in
  `videos.json`).
- Any videos whose captions are disabled on YouTube land with `chunks: []` — listed in the
  fetch tally. Options later: author a transcript, or swap the source video.
- Auto-generated (ASR) captions are noisy by nature; `captionKind` in each cache file flags
  which videos use them.

---

## Result

**Partially executed — fetch transport is blocked from this environment.**

Done and verified:
- `video` document type added (`studio/schemaTypes/documents/video.ts`), registered in
  `index.ts` + `structure.ts`. `npm run typegen` → `sanity.types.ts` now has `Video`
  (`chapters[]{startSeconds,label,_type:"chapter",_key}`, `chunks[]{startSeconds,text,
  _type:"chunk",_key}`). Studio `tsc --noEmit` clean. Web `lint` (0 errors) + `tsc
  --noEmit` clean.
- Pipeline code written: `studio/scripts/ingest/{lib,fetch-youtube,build-video-ndjson,
  ingest}.mjs` + `README.md`. Parsing/transform logic unit-checked in isolation
  (`ytInitialPlayerResponse` extraction, caption-track pick, cue→chunk grouping,
  chapter dedupe, `_id` convention, entity decode all correct).

Blocker:
- YouTube's `api/timedtext` caption endpoint returns **empty 200s** from this
  environment/IP (verified via curl and Node, all `fmt` variants, watch-page
  `captionTracks[].baseUrl`). Innertube `youtubei/v1/player` (ANDROID/IOS/WEB/TV
  clients) is bot-gated → `UNPLAYABLE`/400. `yt-dlp` is not installed. The watch page
  HTML fetched from here also no longer carries `chapteredPlayerBarRenderer`.
- So `cache/` cannot be populated and no `video` docs were imported. The 120 docs
  remain skeletons (`chapters:[]`, `chunks:[]`).

Update: the plain caption-URL scrape returned empty even from the user's Mac
(residential IP) — YouTube `pot`-token enforcement now hits the WEB client
everywhere. Decision (question panel): **rewrite `fetch` around `yt-dlp`**.

- `lib.mjs` trimmed to the transform helpers + `cuesFromJson3` (yt-dlp `.json3`
  subs use the same shape), `chaptersFromInfoJson`, `pickEnglish`. HTML-scrape
  helpers removed.
- `fetch-youtube.mjs` now shells out to `yt-dlp --skip-download --write-info-json
  --write-subs --write-auto-subs --sub-format json3` per video into a tmp dir,
  reads `info.json` (`subtitles` / `automatic_captions` / `chapters`) + the
  `.en*.json3` sub file, writes the same `cache/<id>.json` shape. Startup checks
  `yt-dlp --version` (install hint on miss). `YTDLP_COOKIES_FROM_BROWSER` env
  passes `--cookies-from-browser` for bot checks. Still idempotent; still retries
  `captionKind:"empty"`.
- `build` / `import` / schema unchanged. New prerequisite: `brew install yt-dlp`.

**User runs `fetch` locally and commits `cache/`**, then `build` + `import
--replace` + verify complete the job.

Remaining (after the cache is committed):
- `node studio/scripts/ingest/build-video-ndjson.mjs > video-docs.ndjson`
- `cd studio && npx sanity dataset import video-docs.ndjson production --replace`
- verify: `count(*[_type=="video"])`==120; `count(*[_type=="video" && count(chunks)>0])`
  == 120 − (captions-disabled set); chunks short + sorted; chapters populated where
  YouTube has them.
