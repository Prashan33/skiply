Date: 2026-08-31

## Prompt

> Upgrade search with two stage timestamp resolution (chapters first, transcript
> fallback) and on site timestamped playback. Result cards deep link to the lesson
> page at the matched second and the embedded player seeks to it.

Question panel answer:
- **Data path** → *Wire it now, data-pending.* Build the full two-stage resolution
  even though every `video` doc is currently empty (YouTube ingestion is bot-blocked).
  It produces correct video-moment results the instant real chapter/transcript data
  lands; today it degrades to lesson results / `startSeconds: 0`. Verify structurally
  plus with a small committed fixture.

---

## Goal

Make search resolve a real start second for a matched lesson and surface it as a
VIDEO result that plays from that second on-site (AGENTS §7 / §11):

1. **Two-stage resolution, server-side.** After the LLM's GROQ gather returns the
   relevant lesson slugs, the route resolves a `startSeconds` for each by matching
   the query keywords against the lesson's linked `video` document — **chapters
   (`chapters[].label`) first, transcript (`chunks[].text`) only as a fallback when
   no chapter matches** (AGENTS §7). Deterministic keyword scoring in code; the
   transcript never goes near the LLM (AGENTS §12).
2. **Grounded `startSeconds` through the pipeline.** The FORMAT step copies the
   resolved integer verbatim and marks `kind: "video"` for lessons that resolved a
   moment; everything else stays `kind: "lesson"` / `startSeconds: 0`.
3. **On-site timestamped playback.** The result card already deep-links
   `/lessons/<slug>?t=<sec>&ref=search` and the lesson page already seeks the
   provider embed to `?t=`. Add: **autoplay when arriving at a non-zero second**
   (a search "watch from" jump or a shared deep link) so the player actually starts
   at that moment, for all three providers.
4. **Config parity.** Update the `sanity.agentContext` instructions and the inline
   prompts so neither still says "transcript data is not available — return
   `startSeconds: 0`" (AGENTS §10 / §11: critical rules in both).

### Explicitly out of scope

- **Real transcript/chapter ingestion.** All 120 `video` docs in `g178ibto/production`
  have `chapters: []` / `chunks: []`; the committed `studio/scripts/ingest/cache/` is
  41 files, all `captionKind: "empty"`. Unblocking `yt-dlp --cookies-from-browser`
  ingestion is a separate task the user runs locally (see the video-ingestion prompt).
  A tiny committed fixture stands in for verification here.
- **Semantic search** (`text::semanticSimilarity()`) — embeddings are a billing
  decision (AGENTS §12). Keyword match with wildcards only.
- **Vimeo/Bunny ingestion** — no such sources exist; all 120 videos are YouTube.
- **Widening the MCP `groqFilter` to include `video`.** Not needed and undesirable:
  the route resolves moments with the server read client (full dataset access via the
  token), so the LLM's MCP scope stays `_type in ["course","lesson"]` and no
  transcript array is ever handed to the model (AGENTS §12). No agentContext re-import
  for scope — only the `instructions` text changes.
- Per-learner progress, Conversation Insights.

## Skills / docs read

- **AGENTS.md** — §1–§2 (loop: read, inspect, prompt, approve, build, check, report
  in 3 headings), §3 (reproduce `design/vertex-search.png` exactly; the design's VIDEO
  card already shows "Watch from MM:SS" + a duration badge and nothing else new — no
  card layout change), §5 (search API is a server route that connects to the MCP,
  injects schema + system prompt, calls the LLM, streams structured results; the
  browser holds no token, never calls the MCP/LLM, never writes; the video pipeline is
  offline and never in the request path — this task does **not** touch the pipeline,
  only reads the docs it fills), §7 (surface result cards not a chatbox; **ground every
  result — never invent a timestamp**; video intelligence lives in `video` docs and is
  internal-only, never a standalone result; **timestamps resolve chapters first, then
  transcript**; playback stays on-site via the provider embed with a start-seconds
  param; a result links to the lesson page with `?t=`), §8 (a `video` doc = `id`,
  `url`, `chapters[]{startSeconds,label}`, `chunks[]{startSeconds,text}`; lessons link
  by `videoUrl == video.url`; "Module N"/"Lesson N.M" derived from order, not stored),
  §10 (the Context doc carries `groqFilter` + `instructions` as short deltas; edit it
  by import since the Studio plugin lags the Sanity major; instruction edits reach the
  agent next request, inline-prompt changes need a server restart), §11 (full results
  page, uncapped, count + sort; **two result kinds** — a VIDEO result carries the
  matched second and its action "watches from that second", a LESSON result opens the
  lesson; token-based match — wildcard keywords, OR terms, never phrase-match; can't
  text-match Portable Text directly; put the critical query/ranking rules in **both**
  the inline prompt and the Context doc), §12 (**never return a whole transcript or
  chunks array to the model** — fetch only the filtered matches, a few per video;
  dataset is private, read token server-only; if `text::semanticSimilarity()` errors,
  fall back to wildcard keyword match; cached initial context ⇒ prompt changes need a
  restart; if a system prompt is a template literal, escape backticks), §13 (checks:
  web typecheck + lint + build + dev; for search work verify against the live MCP),
  §14 (keep it small; preserve the server/client boundary and the private-token rule;
  match the provided UI exactly).
- **`agent/skills/create-agent-with-sanity-context/SKILL.md` + `references/nextjs-agent.md`**
  — MCP URL forms (`…/context/mcp/:projectId/:dataset[/:slug]`), `?groqFilter=` /
  `?instructions=` URL overrides win over the doc, `/initial-context` fetched once and
  cached, exclude the `initial_context` tool, tools are `groq_query` / `schema_explorer`,
  the `sanity.agentContext` shape (`slug`, `instructions`, `groqFilter`). Confirms:
  editing `instructions` alone needs no code change and takes effect on the next
  request; the route already implements the cache + URL handling.
- **`agent/skills/dial-your-context/SKILL.md`** — Instructions field = pure deltas,
  scannable bullets not prose, never restate the schema, verify claims against data,
  keep it tight.
- **`agent/skills/shape-your-agent/SKILL.md`** — system prompt = behaviour/voice/
  boundaries only, every rule needs a trigger, don't duplicate the Instructions field.
- **`node_modules/next/dist/docs/`** — `01-app/.../route.md` (`route.ts` POST, Web
  `Request`/`Response`, not cached by default), `.../page.md` + `dynamic-routes.md`
  (`searchParams` is a promise; reading it forces dynamic rendering — the lesson page
  already does). No Next API surface change in this task.
- **`ai` / `@ai-sdk/*`** (installed: `ai@7.0.85`, `@ai-sdk/openai@4.0.52`,
  `@ai-sdk/react@4.0.88`, `@ai-sdk/mcp@2.0.41`, `zod@4.5.4`) — keep the existing
  two-phase shape: `generateText` + MCP tools for GATHER, `streamText` +
  `output: Output.object(...)` for FORMAT, `result.toTextStreamResponse()`, client
  `useObject`. No new deps.

## Code / data inspected

- **`app/api/search/route.ts`** — two phases already. Phase 1 GATHER: `generateText`
  with MCP GROQ tools, `prepareStep` forces a tool call on step 0, `stopWhen:
  stepCountIs(4)`; tool results + `gather.text` are sliced to `MAX_FINDINGS_CHARS`
  (12k) and are the only allowed slug source. Phase 2 FORMAT: `streamText` +
  `Output.object({ schema: searchResponseSchema })`, no tools, fed `parsed.query` +
  the findings blob. `GROQ_FILTER = '_type in ["course","lesson"]'` is only appended
  as `?groqFilter=` when the URL has **no** Context-doc slug (`hasContextSlug`); our
  `.env.local` URL ends `/vertex-search`, so the **doc's** filter applies and `video`
  is out of the MCP's reach — intentional, we keep it that way. `FORMAT_PROMPT` line
  ~99: *"`startSeconds`: always 0 (transcript/chapter data is not ingested yet)."* —
  **this is what changes.** `SCHEMA_HINT` / `GATHER_PROMPT` only mention `title` +
  `pt::text(notes)` — unchanged. `runtime = "nodejs"`, `maxDuration = 60`. `auth()` +
  server-side `search_performed` PostHog capture already there. Route already imports
  nothing from `sanity/lib` — it will now import `getReadClient` (server-only,
  transitively fine in a Node route).
- **`lib/search.ts`** (pure, no `server-only`) — `searchResultSchema` already has
  `startSeconds: z.number().int().min(0)` and `kind: z.enum(["video","lesson"])`.
  `groundResults()` joins model results to the Sanity-derived `SearchIndex` by
  `lessonSlug`, **drops unknown slugs**, de-dupes, and already floors `startSeconds`
  (`item.startSeconds > 0 ? Math.floor(item.startSeconds) : 0`). Doc comments say
  "Always 0 for now" / "heuristic until the ingestion pipeline lands" — update the
  wording. No schema shape change needed; `startSeconds` is already in `required`.
- **`components/search/ResultCard.tsx`** — already builds
  `href = start > 0 ? '/lessons/<slug>?t=<start>&ref=search' : '/lessons/<slug>'`,
  already renders `Watch from ${formatClock(start)}` when `start > 0` (else "Watch
  lesson"), already shows the `durationClock` badge on the thumbnail. **No change** —
  it lights up automatically once `startSeconds` is non-zero. Matches
  `design/vertex-search.png` (VIDEO card: "Watch from 12:45", duration badge, no
  extra label field).
- **`components/search/SearchResults.tsx`** — `useObject({ api: "/api/search", schema:
  searchResponseSchema })`, grounds via `groundResults(object?.results, index)`, sort
  (Most Relevant keeps model order), `search_result_opened` already logs
  `start_seconds`. **No change.**
- **`app/lessons/[slug]/page.tsx`** — `startSeconds = parseStartSeconds(sp.t ??
  sp.start, lesson.duration)` (clamped to duration), passes it to `<LessonVideo
  startSeconds={…} />`, and fires `lesson_resumed` with `source: ref === "search" ?
  "search" : "deep_link"` when `startSeconds > 0`. **No change.**
- **`components/lesson/LessonVideo.tsx`** — renders `<iframe src={embedSrc(parsed,
  startSeconds)} …>`; `attachVideoTracker` wires analytics. Autoplay is currently
  **never** requested. To make "watch from MM:SS" actually play, `embedSrc` needs an
  autoplay flag when `startSeconds > 0` (see decisions).
- **`lib/video.ts`** (pure) — `parseVideoUrl` (YouTube/Vimeo/Bunny), `embedSrc(parsed,
  startSeconds)`:
  - YouTube → `youtube-nocookie.com/embed/<id>?rel=0&modestbranding=1&playsinline=1&enablejsapi=1[&start=<s>]`
  - Vimeo → `player.vimeo.com/video/<id>?title=0&byline=0&portrait=0[#t=<s>s]`
  - Bunny → `iframe.mediadelivery.net/embed/<lib>/<guid>?autoplay=false&preload=true[&t=<s>]`
  `parseStartSeconds(raw, maxSeconds)` clamps to `[0, maxSeconds]`. This is where the
  autoplay flag goes.
- **`sanity/lib/queries.ts`** — `defineQuery` GROQ, TypeGen → `/sanity.types.ts`.
  `LESSON_BY_SLUG_QUERY` already resolves the course via `*[_type == "course" &&
  references(^._id)][0]` and projects `pt::text(notes[0])` — the `^`-reverse-reference
  pattern the new query reuses. No query reads `video` docs yet.
- **`sanity/lib/fetch.ts`** — `getReadClient()` = `client.withConfig({ token:
  requireToken(), useCdn: false })`, `import 'server-only'`. `getSearchIndex()` passes
  `{ next: { revalidate, tags } }`. New helper follows the same shape but **no
  cache** (the token match set is query-specific and cheap).
- **Live dataset (`g178ibto/production`, via the read token)** — `count(*[_type ==
  "video"])` = 120; `withChapters` = 0; `withChunks` = 0. **Every** lesson's
  `videoUrl` joins to exactly one `video.url` (`count(*[_type=="lesson" && count(
  *[_type=="video" && url==^.videoUrl])>0])` = 120) — both are
  `https://www.youtube.com/watch?v=<id>`, exact string match, join is safe.
  `*[_type=="sanity.agentContext"][0]` = slug `vertex-search`, `groqFilter` `_type in
  ["course","lesson"]`, `instructions` still ends with *"### Video moments — Transcript/
  chapter data is not available yet … Do not attempt timestamp matching. Return
  `startSeconds: 0`."*
- **`studio/scripts/seed/agent-context.ndjson`** — the importable source for that doc.
  Its `### Video moments` block is what we rewrite; `groqFilter` unchanged.
- **`.env.local`** — `SANITY_CONTEXT_MCP_URL`, `OPENAI_API_KEY`, `SANITY_API_READ_TOKEN`,
  PostHog, Clerk all set; MCP URL already has the `/vertex-search` slug.

## Decisions & assumptions

### A. Keyword tokeniser — `lib/search.ts` (pure, exported)

```ts
/** Query → distinct lowercased match tokens, ≥3 chars, stopwords dropped, capped at 8. */
export function queryTokens(query: string): string[]
/** Same tokens wrapped for GROQ `match` (`data` → `*data*`). */
export function groqMatchTokens(query: string): string[]
```

- Split on `/[^a-z0-9]+/i`, lowercase, drop a small stopword set (`the a an of to in
  on for and or with how what why when your you is are be get set use using vs`), drop
  `< 3` chars, de-dupe preserving order, cap 8.
- Pure and dependency-free so the route (server) imports it; not used client-side but
  it lives with the rest of the search contract.
- Empty result (e.g. query "how to use it") → no tokens → resolution is skipped, every
  result stays a LESSON at `0`. Acceptable and safe.

### B. Video-moment query — `sanity/lib/queries.ts`

```groq
export const VIDEO_MOMENTS_QUERY = defineQuery(`
  *[_type == "lesson" && slug.current in $slugs]{
    "lessonSlug": slug.current,
    "video": *[_type == "video" && url == ^.videoUrl][0]{
      "chapterHits": chapters[label match $tokens]{ startSeconds, label },
      "chunkHits":   chunks[text match $tokens][0...6]{ startSeconds, text }
    }
  }
`)
```

- `$tokens` = `groqMatchTokens(query)` (array RHS of `match` = "any token matches").
- **Only the filtered matches are projected** — never the whole `chunks` array
  (AGENTS §12). `[0...6]` caps the transcript fallback per video. `chapters` is small
  (a TOC) so it is not sliced.
- `label match $tokens` when `$tokens` is `[]` → GROQ returns no hits; the route
  guards on empty tokens before calling anyway.
- Result rows for lessons whose `video` doc is missing → `video: null` → treated as
  "no moment". With today's empty docs every row is `chapterHits: [], chunkHits: []`.

### C. Resolution — `resolveVideoMoments()` in `app/api/search/route.ts`

Server-only, no LLM. Signature:

```ts
async function resolveVideoMoments(
  slugs: string[],
  query: string,
): Promise<Map<string /*lessonSlug*/, number /*startSeconds*/>>
```

1. `const tokens = queryTokens(query)`; if `tokens.length === 0 || slugs.length === 0`
   → return an empty map (no resolution).
2. `getReadClient().fetch(VIDEO_MOMENTS_QUERY, { slugs: slugs.slice(0, 30),
   tokens: groqMatchTokens(query) })` — cap the slug set defensively; no `next` cache.
   Wrapped in try/catch: on any error log `[search] moment resolve failed` and return
   an empty map (search still returns lesson results — never 503 for this).
3. For each row, **two stages** (AGENTS §7 — chapters first, transcript only as
   fallback):
   - `pick(hits, textKey)` = score each hit by the count of **distinct raw tokens**
     (un-wildcarded, from `queryTokens`) that appear as a substring of
     `hit[textKey].toLowerCase()`; keep the max score; tiebreak on the **lowest**
     `startSeconds` (earliest mention). Ignore hits with score 0.
   - `const chosen = pick(video.chapterHits, "label") ?? pick(video.chunkHits, "text")`.
   - If `chosen` and `Number.isInteger(chosen.startSeconds) && chosen.startSeconds >= 0`
     → `map.set(lessonSlug, chosen.startSeconds)`.
4. Return the map. Lessons absent from the map have no resolved moment.

Rationale: GROQ `match` already does the token filtering; the JS pass only ranks the
handful of survivors and enforces "chapter beats chunk". No `text::semanticSimilarity`
(AGENTS §12). Deterministic ⇒ no fabricated second is possible — every value is a real
`startSeconds` from a real `video` doc.

### D. Wiring into the route

Between phase 1 and phase 2:

```ts
// Slugs the model actually grounded in its GROQ results (parse the JSONL findings).
const groundedSlugs = extractSlugsFromFindings(toolFindings, gather.text);
const moments = await resolveVideoMoments(groundedSlugs, parsed.query);
```

- `extractSlugsFromFindings` — scan the findings text for `"lessonSlug"` values (the
  GATHER_PROMPT already emits one JSON object per line with `lessonSlug`). Best-effort
  regex / `JSON.parse` per line; dedupe. This is only to bound the `VIDEO_MOMENTS_QUERY`
  input — the authoritative grounding is still `groundResults` on the client.
- Build the FORMAT prompt's findings blob so each lesson line is followed, when
  applicable, by a marker line:
  `RESOLVED_MOMENT lessonSlug=<slug> startSeconds=<int>`
  Only real integers from `moments` are ever written here.

### E. FORMAT prompt + `lib/search.ts` wording

- `FORMAT_PROMPT` `## Fields` — replace the `startSeconds` bullet with:
  - `startSeconds`: **If** the findings contain a `RESOLVED_MOMENT` line for this
    `lessonSlug`, set `startSeconds` to that exact integer and set `kind` to `"video"`.
    Otherwise set `startSeconds` to `0`.
  - `kind`: `"video"` for any lesson with a `RESOLVED_MOMENT`; otherwise default
    `"lesson"`, upgrading to `"video"` only when the lesson's value is mainly a
    walkthrough/demo (judge from title + notes excerpt).
  - Keep: never invent or alter a `startSeconds`; if there is no `RESOLVED_MOMENT`
    line, `0` is the only allowed value.
- `GATHER_PROMPT` / `SCHEMA_HINT` — unchanged (the model still matches only
  `title` + `pt::text(notes)`; moment resolution is the route's job). Add one line to
  GATHER: "Do not query `video`, transcripts, or chapters — the app resolves
  timestamps after you." (defence against the model trying, given the new capability
  in the Context doc).
- `lib/search.ts` — update the `startSeconds` field comment and the file header note
  that currently say "Always 0 for now" / "heuristic until the ingestion pipeline
  lands" to describe the real two-stage resolution. No code change to `groundResults`
  (its existing floor/clamp is correct).

### F. Autoplay on deep-link — `lib/video.ts` + `components/lesson/LessonVideo.tsx`

`embedSrc(parsed, startSeconds)` — when `start > 0`, also request autoplay so the
learner lands mid-lesson already playing (AGENTS §7: the action "watches from that
second"). When `start === 0`, behaviour is unchanged (no autoplay).

- YouTube: add `autoplay=1` (and keep `enablejsapi=1`). Muted autoplay is not forced —
  a user-initiated navigation (clicking a result) satisfies most browsers' gesture
  rules; if a browser still blocks it the poster/embed shows and the user hits play,
  same as today.
- Vimeo: `?autoplay=1` in the query (alongside `#t=<s>s`).
- Bunny: flip `autoplay=false` → `autoplay=true` when `start > 0`.

No signature change; `LessonVideo` already passes `startSeconds`. `parseStartSeconds`
already clamps to the lesson duration so a stale `?t=` can't exceed the video.

Assumption: autoplay-with-sound may be blocked in some browsers; that is acceptable
and matches the current fallback. Not adding a mute param — the design shows a normal
player.

### G. `sanity.agentContext` instructions — `studio/scripts/seed/agent-context.ndjson`

Replace the `### Video moments` block with (delta, per `dial-your-context`):

```markdown
### Video moments
- You match lessons only. After you return them, the app resolves a start time for
  each from its linked `video` document — matching the query keywords against
  `video.chapters[].label` first and `video.chunks[].text` only when no chapter
  matches. Do not query `video`, chapters, or transcripts yourself.
- A lesson whose video yields a matched moment becomes a VIDEO result that plays from
  that second; the others are LESSON results.
```

`groqFilter` stays `_type in ["course","lesson"]`. The user re-imports the doc
(`cd studio && npx sanity dataset import scripts/seed/agent-context.ndjson production
--replace`); the change reaches the agent on the next request. The **inline** prompt
change needs a dev-server restart (AGENTS §12).

### H. Verification fixture — `studio/scripts/seed/sample-video-moments.ndjson` (new, test-only)

Because prod `video` docs are empty, add a **committed, clearly-labelled** NDJSON that
`--replace`s 3 real `video` docs with hand-authored `chapters` (+ a couple of `chunks`
on one of them so the transcript fallback path is exercised). Pick videos whose
lessons match common queries:

- one with chapters containing "Data Fetching" / "Server Components" (→ chapter hit),
- one with **no** chapters but chunks mentioning "caching" / "revalidate" (→ fallback),
- one left as a control.

Header comment: *"TEST FIXTURE — not part of the content model. Import to demo the
two-stage resolver before the real yt-dlp ingestion runs; real ingestion (`--replace`)
overwrites these. To clear, re-import `videos-to-ndjson` skeletons or run the pipeline."*
Exact `_id`s chosen at implementation time from the live dataset.

## Files expected to touch

**New**
- `studio/scripts/seed/sample-video-moments.ndjson` — test-only fixture (H).

**Edited**
- `app/api/search/route.ts` — `resolveVideoMoments()` + `extractSlugsFromFindings()`,
  call between phases, `RESOLVED_MOMENT` lines in the FORMAT findings blob, FORMAT/
  GATHER prompt text, import `getReadClient`.
- `lib/search.ts` — `queryTokens()` / `groqMatchTokens()`, update `startSeconds`
  comments. No behavioural change to `groundResults`.
- `sanity/lib/queries.ts` — `VIDEO_MOMENTS_QUERY`.
- `sanity/lib/fetch.ts` — `getVideoMoments(slugs, query)` thin wrapper (or inline the
  fetch in the route; pick one — leaning wrapper for symmetry with `getSearchIndex`).
- `lib/video.ts` — autoplay flag in `embedSrc` when `startSeconds > 0` (F).
- `studio/scripts/seed/agent-context.ndjson` — `### Video moments` block (G).
- `sanity.types.ts` — regenerated by `npm run typegen` (adds `VIDEO_MOMENTS_QUERY_RESULT`).
- `prompts/2026-08-31-search-two-stage-timestamps.md` — this file; Result appended.

**Not touched**
- `components/search/ResultCard.tsx`, `components/search/SearchResults.tsx`,
  `app/search/page.tsx` — already render `startSeconds > 0` as "Watch from MM:SS" +
  `?t=` deep link; nothing to add for the design.
- `app/lessons/[slug]/page.tsx` — already reads `?t=`/`?start=`, clamps, fires
  `lesson_resumed`.
- `components/lesson/LessonVideo.tsx` — only benefits from the `embedSrc` change; no
  edit unless the autoplay flag needs a prop (it does not).
- `studio/scripts/ingest/**` — the offline pipeline is unchanged (AGENTS §5/§9).
- `proxy.ts`, `next.config.ts`, `.env.example` (no new vars; the MCP scope is
  unchanged).

## Requirements

1. `POST /api/search {"query":"data fetching"}` against the live MCP + a dataset where
   at least one matched lesson's `video` has a matching chapter: the response is
   `searchResponseSchema`-valid, and that lesson comes back `kind:"video"` with
   `startSeconds` equal to a **real** `chapters[].startSeconds` from its `video` doc.
2. Chapters are tried before transcript: a lesson whose `video` has **no** matching
   chapter but a matching `chunk` resolves to that `chunks[].startSeconds`. A lesson
   with neither stays `kind:"lesson"` / `startSeconds:0`.
3. No transcript or full `chunks` array is ever sent to the LLM — only `[0...6]`
   filtered `{startSeconds,text}` rows reach the **route**, and nothing from `video`
   reaches either LLM call (AGENTS §12). The MCP `groqFilter` still excludes `video`.
4. A fabricated second is impossible: `startSeconds` on a card is either `0` or a
   value that exists in a `video` doc. `resolveVideoMoments` failure → lesson results
   only, never a 503.
5. The VIDEO result card deep-links `/lessons/<slug>?t=<startSeconds>&ref=search`
   (already implemented) and reads "Watch from MM:SS"; the LESSON card opens
   `/lessons/<slug>`. Reproduces `design/vertex-search.png`.
6. Opening `/lessons/<slug>?t=<n>` (n>0) seeks the provider embed to `n` **and**
   starts playback (autoplay) for YouTube, Vimeo, and Bunny; `?t=0` / no param is
   unchanged (no autoplay). `parseStartSeconds` still clamps to the lesson duration.
7. The two-stage rule (chapters first, transcript fallback) and "the app resolves
   timestamps, the agent matches lessons only" appear in **both** the inline route
   prompt and `agent-context.ndjson` instructions (AGENTS §10/§11).
8. `npm run typegen` regenerates `sanity.types.ts` with `VIDEO_MOMENTS_QUERY_RESULT`;
   web typecheck / lint / build clean.
9. With the committed fixture imported, the manual steps below demonstrate a real
   chapter hit, a real transcript-fallback hit, and on-site autoplay-at-second.

## Security considerations

- `SANITY_API_READ_TOKEN` / `OPENAI_API_KEY` stay server-only — `resolveVideoMoments`
  uses `getReadClient()` (`server-only`, Node route). Nothing new reaches the browser;
  the response body is still just `searchResponseSchema`.
- `VIDEO_MOMENTS_QUERY` is read-only and **parameterised** (`$slugs`, `$tokens`) — no
  string interpolation into GROQ, no injection surface. `$slugs` is the model's own
  grounded output, capped at 30; `$tokens` is derived from the user query by
  `groqMatchTokens` (alphanumeric-only, wildcard-wrapped).
- Transcript exposure is bounded: `chunks[text match $tokens][0...6]` — a few short
  rows per video, only into the route, never into an LLM prompt or the client
  (AGENTS §12).
- `startSeconds` written into the FORMAT findings blob is always `Number.isInteger`
  and `>= 0`; `groundResults` floors it again; the lesson page clamps it to
  `lesson.duration`. A hallucinated or out-of-range value cannot reach the embed.
- `resolveVideoMoments` is fully wrapped in try/catch and degrades to "no moments" —
  a Sanity hiccup never turns a search into a 503 or leaks an error to the client.
- Autoplay only changes provider embed query params on the existing same-origin-ish
  iframe; no new script, no new permission, `allow="… autoplay …"` is already set on
  the iframe.
- The `sample-video-moments.ndjson` fixture is test data for a private dataset,
  imported manually via the authenticated CLI (no repo write token), and is overwritten
  by real ingestion.

## Acceptance criteria

- `npm run typegen` (root) → `sanity.types.ts` gains `VIDEO_MOMENTS_QUERY_RESULT`, no
  TypeGen errors.
- `npx tsc -p tsconfig.json --noEmit` — clean.
- `npm run lint` — no new errors (pre-existing `.agents/` skill-template warnings ok).
- `npm run build` — succeeds; `/api/search` still `ƒ` (dynamic), `/search` dynamic.
- Live MCP, **fixture imported**:
  - `curl -sS -X POST localhost:3000/api/search -H 'content-type: application/json'
    -d '{"query":"data fetching server components"}' | jq` → at least one result with
    `kind:"video"` and `startSeconds` matching a fixture chapter second; every
    `lessonSlug` real; list uncapped.
  - A query that hits only the no-chapter fixture video (e.g. `"caching revalidate"`)
    → that lesson `kind:"video"`, `startSeconds` = the fixture `chunk` second.
  - A query with no `video` match → all `kind:"lesson"`, `startSeconds:0` (today's
    behaviour for the 117 empty videos).
- Live MCP, **no fixture** (prod as-is): every result is `kind:"lesson"` /
  `startSeconds:0`; search still works; no 503.
- `git status` shows only the files listed above (+ regenerated `sanity.types.ts`).

## Checks to run

1. `sanity/lib/queries.ts` edited → `npm run typegen` (root).
2. `npx tsc -p tsconfig.json --noEmit`
3. `npm run lint`
4. `npm run build`
5. `npm run dev` + the manual steps.
6. Live MCP curl checks above (needs the fixture import + a dev-server restart for the
   inline-prompt change).

## Manual test steps

1. `cd studio && npx sanity dataset import scripts/seed/sample-video-moments.ndjson
   production --replace` → 3 `video` docs updated. Then re-import
   `scripts/seed/agent-context.ndjson --replace`. Restart `npm run dev` (root).
2. `/search?q=data fetching server components` — the matching lesson shows as a VIDEO
   card reading **"Watch from MM:SS"** with MM:SS = the fixture chapter time; the
   duration badge is unchanged; layout matches `design/vertex-search.png`.
3. Click "Watch from MM:SS" → `/lessons/<slug>?t=<sec>&ref=search`; the embed is on
   the page (not youtube.com), **starts playing near that second**. Scrub bar begins
   at ~MM:SS.
4. `/search?q=caching revalidate` (hits the no-chapter fixture video) → that lesson is
   a VIDEO card; its second equals the fixture `chunk` start (transcript fallback).
5. `/search?q=typescript generics` (or any query with no fixtured video) → all cards
   are LESSON, "View lesson", no `?t=`.
6. Change sort to "Course name" / "Lesson title" → reorders client-side, VIDEO/LESSON
   kinds and seconds unchanged.
7. Open `/lessons/<slug>` with **no** `?t=` → embed does **not** autoplay (unchanged).
   Open `/lessons/<slug>?t=99999` → clamped to the lesson duration, no error.
8. Network tab / server logs: `/api/search` response contains no transcript text; the
   `groq_query` MCP calls in the logs never touch `_type == "video"`.
9. `curl` the three queries from *Acceptance criteria*; confirm the `kind` /
   `startSeconds` values.
10. Root `npm run lint && npx tsc --noEmit && npm run build` — all pass.
11. `grep -r` the `.next/static` chunks for the read token / OpenAI key / MCP URL —
    absent.

## Needs your attention

- **Import the fixture + re-import the agent context, then restart dev.** Two-stage
  resolution is dead code until a `video` doc has a matching `chapters`/`chunks`
  entry; prod has none. Steps in Manual test 1. Real `yt-dlp` ingestion later
  (`--replace`) overwrites the fixture docs.
- **Inline-prompt change needs a server restart** to take effect (cached initial
  context, AGENTS §12). The `agent-context.ndjson` `instructions` change takes effect
  on the next request after re-import.
- **Autoplay-with-sound may be blocked** by a browser that doesn't count the result
  click as a gesture for the new iframe; the player then shows ready-to-play at the
  right second and the user hits play — same fallback as today. Say if you want
  muted autoplay instead.
- **`startSeconds` is copied by the FORMAT model**, not re-verified on the client
  (the client has no per-query moment map). Mitigations: the model only ever sees
  real integers, `groundResults` floors, the lesson page clamps to duration. If you
  want it bulletproof, a follow-up can switch FORMAT to non-streaming + a server-side
  overwrite of `startSeconds` from the resolver map (bigger change to the
  `useObject` client).
- **YouTube-only.** No Vimeo/Bunny sources; their embed seek/autoplay is implemented
  but unverifiable here.
- **Ranking of the moment** is "most query tokens in the label, then earliest" — no
  semantic similarity (embeddings are off, AGENTS §12). Good enough for a TOC; revisit
  if chapters get long.

---

## Result

**Shipped (code).** Live MCP end-to-end is user-run (needs the fixture + agent-context
import into `production`).

- `lib/search.ts` — added `queryTokens()` / `groqMatchTokens()` (pure); updated the
  `startSeconds` / `kind` doc comments. `groundResults` unchanged (its floor/clamp
  already covers a copied second).
- `sanity/lib/queries.ts` — `VIDEO_MOMENTS_QUERY` (`$slugs`, `$tokens`;
  `chapters[label match $tokens]` + `chunks[text match $tokens][0...6]` under a
  `^.videoUrl` reverse join). TypeGen → `VIDEO_MOMENTS_QUERY_RESULT`.
- `sanity/lib/fetch.ts` — `getVideoMoments(slugs, tokens)` (read client, no cache).
- `app/api/search/route.ts` — `extractSlugsFromFindings()` +
  `resolveVideoMoments()` (server, no LLM; chapters scored first, transcript chunks
  only as fallback; most distinct tokens present wins, earliest second breaks ties;
  any failure → empty map, never a 503). Called as phase 1b; resolved seconds are
  appended to the FORMAT findings as `RESOLVED_MOMENT lessonSlug=… startSeconds=…`
  lines. GATHER prompt now forbids querying `video`/transcripts; FORMAT prompt copies
  the resolved integer and sets `kind:"video"` for those lessons, else `0` / heuristic.
- `lib/video.ts` — `embedSrc` requests autoplay (YouTube `autoplay=1`, Vimeo
  `autoplay=1`, Bunny `autoplay=true`) **only when `startSeconds > 0`**; `start === 0`
  behaviour unchanged. `LessonVideo` needed no edit.
- `studio/scripts/seed/agent-context.ndjson` — `### Video moments` block rewritten
  (agent matches lessons only; the app resolves the second chapters-first,
  transcript-fallback). `groqFilter` unchanged — the MCP still never sees `video`.
- `studio/scripts/seed/sample-video-moments.ndjson` (+ `.README.md`) — 3 real `video`
  docs patched for verification: a chapter hit, a no-chapter → transcript hit, and a
  chaptered control that matches nothing.
- `components/search/*`, `app/search/page.tsx`, `app/lessons/[slug]/page.tsx` —
  untouched; they already render `startSeconds > 0` as "Watch from MM:SS" + `?t=` deep
  link and seek the embed.

**Checks**

- `npm run typegen` — clean; `VIDEO_MOMENTS_QUERY_RESULT` added, matches the hand types.
- `npx tsc -p tsconfig.json --noEmit` — clean.
- `npm run lint` — 0 errors (3 pre-existing `.agents/` template warnings).
- `npm run build` — succeeds; `/api/search` + `/search` both `ƒ`.
- `VIDEO_MOMENTS_QUERY` run live (read-only, pre-fixture) — parses, the `^.videoUrl`
  join resolves, returns the exact generated shape with empty hit arrays (the current
  no-data path).
- Resolver logic simulated against the fixture rows: `"data fetching server
  components"` → `fetching-in-server-components` = **45s** (chapter); `"caching
  revalidate"` → `caching-and-revalidation` = **160s** (transcript fallback, no
  chapters); `"typescript generics"` → `{}` (no fabricated second). Control doc never
  resolves.
- Live MCP `/api/search` end-to-end: **not run** — requires importing
  `sample-video-moments.ndjson` + the updated `agent-context.ndjson` into the private
  `production` dataset (left to the user, per the manual steps).
