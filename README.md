# Skiply

An AI‑powered learning platform with **intelligent, timestamp‑accurate search**.

Authors build courses in Sanity Studio. Learners browse them on a Next.js site
and — the part that makes Skiply different — type a plain‑language question into
search and get back ranked result cards. Each card links straight to the exact
second in a lesson's video where that topic is taught, and the video plays on the
site itself in the provider's own player.

> Internally the product is called **Vertex**; the repo and package are `skiply`.

---

## Table of contents

- [How search works](#how-search-works)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Content model](#content-model)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Video ingestion pipeline](#video-ingestion-pipeline)
- [Deployment](#deployment)
- [Conventions](#conventions)

---

## How search works

Search is a **full results page**, not a chatbox. A query runs through a
three‑phase server pipeline in [`app/api/search/route.ts`](app/api/search/route.ts):

| Phase | What happens | Who does it |
| --- | --- | --- |
| **1. Gather** | An LLM writes GROQ over the content schema through the **Sanity Context MCP** and returns the lessons that actually match the query (title + notes, token‑wildcarded). Tool results are the *only* allowed source of lesson slugs. | `gpt-4.1-mini` + MCP GROQ tools |
| **1b. Resolve** | For each matched lesson, the server (no LLM) matches the query keywords against that lesson's linked `video` document — **chapters first** (`chapters[].label`), **transcript chunks only as a fallback** (`chunks[].text`) — and picks the best `startSeconds`. Only the filtered rows are fetched; no transcript is ever handed to a model. | `resolveVideoMoments` + Sanity read client |
| **2. Format** | A second LLM call turns the grounded findings into ranked result cards (`kind`, `description`, copied `startSeconds`, `relevance`), streamed as JSON. | `gpt-4.1-mini`, structured output |

The browser then joins every slug against a Sanity‑derived index
([`getSearchIndex`](sanity/lib/fetch.ts)) so every label, count, thumbnail and
key point on a card is real data — the model can only pick framing, never invent
a course, lesson, timestamp, or count.

**Result kinds**

- **Video result** — a lesson's video matched at a specific moment. Action:
  *Watch from 5:12* → `/lessons/<slug>?t=312&ref=search` → the embed starts at
  that second via the provider's own start parameter.
- **Lesson result** — a lesson matched on its topic. Action: opens the lesson
  page.

Why the schema blob is not injected, why the system prompt rules are duplicated
in the Context document, and other sharp edges are documented at the top of
`route.ts` and in [`AGENTS.md §11–§12`](AGENTS.md).

---

## Architecture

Two standalone workspaces in one repo. They are deliberately **not** nested, so
each deploys independently and the Studio can auto‑update.

```
skiply/                 ← Next.js web app (this package)
└── studio/             ← Sanity Studio (separate package, own deploy)
```

**Boundaries that must not be crossed** (see `AGENTS.md §5`):

- Pages (catalog, course, lesson, instructor, My Learning) are **read‑only** —
  they render stored content.
- **Auth** is Clerk, gated in Next.js middleware. The secret key is server‑only;
  only the publishable key reaches the browser.
- **Content reads** go through a server‑only Sanity client with a read token
  against a **private** dataset.
- **Search** is a server route → Context MCP → LLM, streamed back to a client
  component.
- **Writes** (learner progress, bookmarks) go through server routes with a write
  token. The browser never holds a token and never writes.
- **Analytics** is PostHog in the browser (public project key); server‑side
  capture keeps any private key on the server.
- **Video ingestion** is offline tooling — it never runs in the request path.

---

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| CMS | Sanity Studio 5 + `next-sanity`, `@sanity/image-url`, `@portabletext/react` |
| Auth | Clerk (`@clerk/nextjs`) |
| Search | Sanity Context MCP (server‑side HTTP) + Vercel AI SDK + OpenAI provider |
| Validation | Zod (query input + structured LLM output) |
| Styling | Tailwind CSS 4 + typography |
| Analytics | PostHog (`posthog-js` browser, `posthog-node` server) |
| Video ingestion | `yt-dlp` + Node scripts (offline) |

---

## Content model

Modeled in `studio/schemaTypes/`. Numbers shown in the UI (`Module 5`,
`Lesson 5.1`) are **derived from order**, never stored.

| Type | Notes |
| --- | --- |
| **course** | Top level: title/slug, marketing fields, `popular` flag, learning outcomes, refs to `instructor` + `category`, ordered `modules[]`. |
| **module** | Embedded object inside a course. Title, summary, ordered refs to `lessons[]`. |
| **lesson** | Document. Title/slug, `videoUrl`, poster, duration, `freePreview`, Portable Text `notes`, `keyPoints`, optional pro tip, `resources[]`. Has **no** parent course field — resolved with a reverse reference. |
| **instructor** | Name/slug, photo, expertise, bio. Own page. |
| **category** | Title/slug, description. |
| **video** | Built by the [ingestion pipeline](#video-ingestion-pipeline), one per unique video URL. `chapters[] { startSeconds, label }` (table of contents) + `chunks[] { startSeconds, text }` (transcript in short timestamped pieces). Internal lookup — never shown as a search result. |
| **agentContext** | Search configuration: content‑scope filter + query instructions. Tuned without a code change; seeded from `studio/scripts/seed/agent-context.ndjson`. |
| **progress** | Per‑learner state keyed by Clerk user id: completed lessons + last position. App state — written only through `POST /api/progress`, kept apart from content. |

Types are generated: `npm run typegen` (writes `sanity.types.ts`).

---

## Repository layout

```
app/
  api/
    search/route.ts       three-phase search pipeline (MCP + LLM)
    progress/route.ts      watch-gated progress writes
    bookmarks/route.ts     course/lesson bookmark writes
  courses/                 catalog + course detail
  lessons/[slug]/          lesson page (video + notes tabs)
  my-learning/             presentational "continue learning" page
  search/                  search results page + client UI
components/
  course/  lesson/  ui/    reused building blocks
lib/
  search.ts                shared search contract (schema, grounding, tokenizer)
  video.ts                 URL → provider embed + start-seconds parsing
  progress.ts              completion rules (watch threshold)
sanity/
  lib/                     server-only read/write clients, queries, fetch helpers
studio/
  schemaTypes/             content model
  scripts/
    ingest/                offline video transcript + chapter pipeline
    seed/                  seed content, agent-context doc, fixtures
```

---

## Local development

**Prerequisites:** Node 20+, a Sanity project (private dataset), a Clerk
application, an OpenAI API key, and a PostHog project. `yt-dlp` only if you plan
to run video ingestion.

```bash
# 1. install
npm install
npm --prefix studio install

# 2. configure — copy and fill in both env files
cp .env.example .env.local
cp studio/.env.example studio/.env.local

# 3. run the Studio (localhost:3333) and seed content
cd studio
npx sanity dataset import scripts/seed/seed.ndjson production
npx sanity dataset import scripts/seed/agent-context.ndjson production
npx sanity deploy            # REQUIRED before the Context MCP will serve the dataset
npm run dev

# 4. run the web app (localhost:3000)
cd ..
npm run dev
```

> The Context MCP only serves a dataset that has a **deployed Studio
> application** — a schema‑only deploy is not enough (`AGENTS.md §12`).

**Scripts** (web workspace):

| Command | Does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | production build |
| `npm run lint` | ESLint |
| `npm run studio` | proxy to `studio` dev server |
| `npm run typegen` | extract schema + regenerate `sanity.types.ts` |

---

## Environment variables

`.env.example` is the canonical list — keep it in sync. Only `NEXT_PUBLIC_*`
values reach the browser.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` / `_DATASET` / `_API_VERSION` | public | Sanity project coordinates |
| `SANITY_API_READ_TOKEN` | **server** | Reads the private dataset; also the Bearer token for the Context MCP |
| `SANITY_API_WRITE_TOKEN` | **server** | Editor token used only by `POST /api/progress` and `POST /api/bookmarks` |
| `PROGRESS_COMPLETE_SECONDS` | server, optional | Override the 7‑minute watch threshold for lesson completion (QA) |
| `SANITY_CONTEXT_MCP_URL` | **server** | Base Context MCP URL; append the config‑doc slug after seeding `agent-context.ndjson` |
| `OPENAI_API_KEY` | **server** | Search LLM calls |
| `OPENAI_SEARCH_MODEL` | server, optional | Defaults to `gpt-4.1-mini` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | public | Clerk browser SDK |
| `CLERK_SECRET_KEY` | **server** | Clerk backend |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` / `*_FALLBACK_REDIRECT_URL` | public | Clerk routing |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` / `_HOST` | public | PostHog browser analytics |

---

## Video ingestion pipeline

Offline tooling in [`studio/scripts/ingest/`](studio/scripts/ingest/) that fills
the `video` documents with timestamped transcript chunks and creator chapter
markers. Full docs: [`studio/scripts/ingest/README.md`](studio/scripts/ingest/README.md).

```bash
brew install yt-dlp

# fetch captions + chapters for every id in studio/scripts/seed/videos.json
node studio/scripts/ingest/fetch-youtube.mjs          # --refresh; --only <id,id>

# build NDJSON video docs and import them in place (count stays 120)
node studio/scripts/ingest/build-video-ndjson.mjs > /tmp/video-docs.ndjson
cd studio && npx sanity dataset import /tmp/video-docs.ndjson production --replace
```

- The `cache/<id>.json` files are **committed** — they are the reproducible
  artifact. `build` and `import` need no network.
- Videos with captions disabled on YouTube land with `chunks: []`; videos with no
  creator chapters get `chapters: []` and search falls back to transcript
  matching.
- YouTube rate‑limits caption downloads (`HTTP 429`) — re‑run to retry the
  stragglers, or set `YTDLP_COOKIES_FROM_BROWSER=chrome`.
- **YouTube only.** Vimeo and Bunny each need their own caption + chapter
  extraction and a playback/seek case before they count as supported.

For a quick demo without running `yt-dlp`, import the three hand‑authored fixture
docs:

```bash
cd studio
npx sanity dataset import scripts/seed/sample-video-moments.ndjson production --replace
```

---

## Deployment

- **Web** — deploy the Next.js app (Vercel or equivalent). Set every server‑side
  env var; never expose a token to the browser.
- **Studio** — `cd studio && npx sanity deploy`. Required before the Context MCP
  will serve the dataset. Deploy the schema and import the seed + config
  documents.
- The search route caches the initial MCP context, so **instruction and system
  prompt changes only take effect after a server restart** (`AGENTS.md §12`).

---

## Conventions

- Read the relevant guide in `node_modules/next/dist/docs/` before writing
  Next.js code — this Next.js major has breaking changes vs. older releases.
- Content is **structured** (Portable Text + typed fields), never markdown.
  Markdown appears only in what the search agent replies.
- Every search result is **grounded** in real data. Never invent a course,
  lesson, price, duration, timestamp, or count.
- `.env*` is gitignored except `.env.example` files — those are the source of
  truth for configuration.
- `AGENTS.md` / `CLAUDE.md` hold the full engineering brief and the
  decisions that are already made.
```