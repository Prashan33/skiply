Date: 2026-08-29

## Prompt

> implement the sanity content model and studio for vertex (course, module, lesson,
> instructor, category) + the server side read client and data layer.

---

## Goal

Stand up the Sanity foundation for Vertex:

1. A **standalone `studio/` workspace** (its own `package.json`, deploys independently)
   holding the schema for `course`, `lesson`, `instructor`, `category` documents and
   the `module` embedded object (plus small supporting objects).
2. The **web (repo root) server-only read layer**: a private-dataset Sanity client with a
   read token, a typed fetch helper, GROQ queries for the catalog / course / lesson /
   instructor / category surfaces, and generated TypeGen types.

Out of scope for this task (later work, per AGENTS.md §8): `video` documents + ingestion,
the `agentContext` search-config document, `progress` records, PostHog, search, and any
page UI. Build only the model + data layer.

## Skills read

- `sanity-best-practices` — SKILL.md, `references/schema.md`, `references/nextjs.md`,
  `references/typegen.md`.
- `content-modeling-best-practices` — SKILL.md (data-over-pages, reference-vs-embed).
- AGENTS.md §5 (workspace split), §6–§8 (stack, fixed decisions, data model), §12
  (private dataset, server-only token, `.env.example` canonical), §13 (checks).

## Code inspected

- `sanity.config.ts`, `sanity.cli.ts` (root) — current **embedded** Studio scaffold.
- `app/studio/[[...tool]]/page.tsx` — `<NextStudio />` route (to be removed).
- `sanity/env.ts`, `sanity/lib/{client,live,image}.ts` — scaffolded web helpers, no token.
- `sanity/schemaTypes/index.ts`, `sanity/structure.ts` — empty schema stubs (move to studio).
- `package.json` — `next 16.3.2`, `next-sanity ^13.3.3`, `sanity ^5.31.2`,
  `@sanity/vision ^5.31.2`, `@sanity/image-url`, `styled-components`, no read token,
  `lint` = `eslint`, no `typegen` script.
- `tsconfig.json` — `include: ["**/*.ts", ...]`, `exclude: ["node_modules", "agent"]`.
- `app/layout.tsx` — `ClerkProvider`, no `<SanityLive />`.
- `.env.local` — has `NEXT_PUBLIC_SANITY_PROJECT_ID="g178ibto"`,
  `NEXT_PUBLIC_SANITY_DATASET="production"`; **no `.env.example` at root**.
- `prompts/` — two prior prompt files; project rebrands "Vertex" → "Skiply" in UI copy
  (not relevant to schema field names here).

## Decisions & assumptions

- **Standalone Studio** (confirmed with user, matches AGENTS.md §5 and
  `nextjs.md` §1A). New `studio/` folder at repo root with its own deps and
  `node_modules`; not wired as npm workspaces (keeps a single React/Sanity copy per app,
  avoids hoist issues). Web keeps `next-sanity` for fetching only.
- **Studio env vars** use the `SANITY_STUDIO_*` prefix (Studio build convention), separate
  from the web app's `NEXT_PUBLIC_SANITY_*`. Same `projectId` (`g178ibto`) + dataset
  (`production`).
- **`duration` = number of seconds** on `lesson` (structured; UI formats to `mm:ss`).
  Same for any clip length. Not a display string.
- **`popular`** stays a `boolean` on `course` — AGENTS.md §8 explicitly calls it a "flag",
  overriding the generic "prefer list over boolean" guidance. `freePreview` on `lesson`
  likewise a boolean (AGENTS.md §7 "Free preview is a label").
- **`notes`** (lesson) and **`bio`** (instructor) are Portable Text (`array` of `block`,
  standard styles/decorators/lists, no custom block types yet) — AGENTS.md §7 "structured,
  never markdown".
- **`keyPoints`** (lesson) and **`expertise`** (instructor) are `array` of `string`.
- **Module / lesson numbers** ("Module 5", "Lesson 5.1") are **not stored** — derived from
  array order on the frontend. GROQ returns modules and their lessons in order.
- **Lesson has no parent-course field** — the lesson query resolves the owning course with a
  reverse reference (`*[_type=="course" && references(^._id)][0]`).
- **`_id`s are Sanity-generated** — no deterministic IDs anywhere (schema global rule).
- **TypeGen** enabled in `studio/sanity.cli.ts`, output committed at repo-root
  `sanity.types.ts`, `schema.json` gitignored. `overloadClientMethods: true` so
  `sanityFetch`/`client.fetch` with `defineQuery` return typed results.
- **Live Content**: keep `defineLive` as the default fetch path, add `serverToken`
  (private dataset needs it) and render `<SanityLive />` in the root layout. Add a
  `useCdn:false`, token-bearing client accessor for `generateStaticParams`-style
  fresh reads.
- Read token is **server-only**: lives in `sanity/lib/token.ts` with `import "server-only"`,
  never imported by a client component, never `NEXT_PUBLIC_`.

## Files to create / change

### Studio workspace (new `studio/`)

- `studio/package.json` — `sanity`, `@sanity/vision`, `@sanity/icons`, `styled-components`,
  `react`, `react-dom`, `typescript`, `@types/react`; scripts: `dev` (`sanity dev`),
  `build` (`sanity build`), `deploy` (`sanity deploy`), `typegen`
  (`sanity schema extract --force && sanity typegen generate`).
- `studio/sanity.config.ts` — moved from root; drop `basePath`; `projectId`/`dataset` from
  `./env`; plugins `structureTool({structure})`, `visionTool`.
- `studio/sanity.cli.ts` — `defineCliConfig` with `api` + `typegen: { enabled: true,
  path: "../{app,sanity,components,lib}/**/*.{ts,tsx}", schema: "./schema.json",
  generates: "../sanity.types.ts", overloadClientMethods: true }`.
- `studio/tsconfig.json` — extends Sanity's base, `jsx: react-jsx`.
- `studio/env.ts` — `projectId`/`dataset` from `SANITY_STUDIO_*` with `assertValue`.
- `studio/structure.ts` — explicit list: Courses, Lessons, Instructors, Categories.
- `studio/.env.example` — `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`.
- `studio/.env` — same values as web (`g178ibto` / `production`) so `sanity dev` runs.
- `studio/.gitignore` — `node_modules`, `dist`, `.sanity`, `schema.json`, `.env*`.
- `studio/schemaTypes/index.ts` — exports `schema.types` array.
- `studio/schemaTypes/documents/course.ts`
  - `title` string (required)
  - `slug` slug (required, source `title`)
  - `summary` text
  - `coverImage` image (`hotspot: true`, `alt` string field)
  - `level` string, `options.list` beginner/intermediate/advanced, radio
  - `price` number (min 0)
  - `popular` boolean (initialValue false)
  - `studentCount` number (min 0)
  - `learningOutcomes` array of `learningOutcome`
  - `instructor` reference → `instructor` (required)
  - `category` reference → `category` (required)
  - `modules` array of `module` (required, min 1)
  - preview: title + instructor name
- `studio/schemaTypes/documents/lesson.ts`
  - `title` string (required)
  - `slug` slug (required, source `title`)
  - `videoUrl` url (required, `uri` scheme http/https)
  - `poster` image (`hotspot: true`, `alt` string)
  - `duration` number — seconds (required, min 0)
  - `freePreview` boolean (initialValue false)
  - `studentCount` number (min 0)
  - `notes` array of `block` (Portable Text)
  - `keyPoints` array of string
  - `proTip` text
  - `resources` array of `lessonResource`
  - preview: title + `mm:ss` duration
- `studio/schemaTypes/documents/instructor.ts`
  - `name` string (required), `slug` slug (required, source `name`),
    `photo` image (hotspot, alt), `expertise` array of string,
    `bio` array of `block`.
- `studio/schemaTypes/documents/category.ts`
  - `title` string (required), `slug` slug (required, source `title`),
    `description` text.
- `studio/schemaTypes/objects/module.ts` — object:
  `title` string (required), `summary` text,
  `lessons` array of reference → `lesson`. Preview shows title + lesson count.
- `studio/schemaTypes/objects/learningOutcome.ts` — object:
  `icon` string (lucide icon name), `title` string (required), `description` text.
- `studio/schemaTypes/objects/lessonResource.ts` — object:
  `type` string `options.list` (link / download / documentation / code), `title` string
  (required), `description` text, `url` url (required).
- All types use `defineType` / `defineField` / `defineArrayMember`, each document/object
  gets an `@sanity/icons` icon imported from its own subpath.

### Web workspace (repo root)

- **Delete** `sanity.config.ts`, `sanity.cli.ts`, `app/studio/`,
  `sanity/schemaTypes/`, `sanity/structure.ts`.
- `package.json` — remove `sanity`, `@sanity/vision`, `styled-components` from deps
  (studio-only now); keep `next-sanity`, `@sanity/image-url`. Add convenience scripts
  `studio` (`npm --prefix studio run dev`) and `typegen` (`npm --prefix studio run typegen`).
- `sanity/lib/token.ts` — **new**, `import "server-only"`; export
  `token = process.env.SANITY_API_READ_TOKEN`; throw a clear error if missing.
- `sanity/lib/client.ts` — keep base `createClient` (`useCdn: true`, no token) for
  image URLs / non-sensitive use.
- `sanity/lib/live.ts` — `defineLive({ client: client.withConfig({ apiVersion }),
  serverToken: token, browserToken: token })` (browserToken only used for overlays in
  draft mode; safe). Export `sanityFetch`, `SanityLive`.
- `sanity/lib/fetch.ts` — **new**; re-export `sanityFetch`; add
  `getReadClient()` → `client.withConfig({ token, useCdn: false })` for
  `generateStaticParams` / fresh reads.
- `sanity/lib/queries.ts` — **new**, all via `defineQuery`, unique scoped names:
  - `CATALOG_COURSES_QUERY` — all courses ordered (popular desc, title): card fields +
    `instructor->{name, "slug": slug.current}`, `category->{title, "slug": slug.current}`,
    `"lessonCount": count(modules[].lessons[])`, `coverImage`.
  - `COURSE_SLUGS_QUERY` — `*[_type=="course" && defined(slug.current)]{"slug": slug.current}`.
  - `COURSE_BY_SLUG_QUERY` — full course: marketing fields, `learningOutcomes`,
    `instructor->{...}`, `category->{...}`,
    `modules[]{ _key, title, summary, lessons[]->{ _id, title, "slug": slug.current,
    duration, freePreview, poster } }`.
  - `LESSON_SLUGS_QUERY`.
  - `LESSON_BY_SLUG_QUERY` — lesson fields + `notes`, `keyPoints`, `proTip`, `resources`,
    plus reverse-ref
    `"course": *[_type=="course" && references(^._id)][0]{ title, "slug": slug.current,
    instructor->{name,"slug": slug.current},
    "moduleIndex": ...,  // position of the module containing this lesson
    "lessonIndex": ... }` — resolve module + lesson ordinal from array position so the
    page can render "Lesson 5.1".
  - `INSTRUCTORS_QUERY`, `INSTRUCTOR_SLUGS_QUERY`,
    `INSTRUCTOR_BY_SLUG_QUERY` — instructor + `bio` + `"courses": *[_type=="course" &&
    references(^._id)]{ title, "slug": slug.current, coverImage }`.
  - `CATEGORIES_QUERY`, `CATEGORY_BY_SLUG_QUERY` (+ its courses).
  - Portable Text plain-text projection helper note: for later search work notes must be
    matched via `pt::text(notes)`; not needed now but queries are written to keep `notes`
    as an array for `@portabletext/react`.
- `sanity/lib/image.ts` — keep.
- `app/layout.tsx` — render `<SanityLive />` at the end of `<body>` (inside/after
  `ClerkProvider` children).
- `tsconfig.json` — add `"studio"` to `exclude` (so root `tsc`/Next build never compiles
  Studio sources); confirm `sanity.types.ts` is picked up by `include`.
- ESLint flat config — add `studio/**` (and `sanity.types.ts`) to `ignores`.
- `.env.example` — **new at root**, canonical list:
  `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`,
  `NEXT_PUBLIC_SANITY_API_VERSION`, `SANITY_API_READ_TOKEN`,
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and the existing
  `NEXT_PUBLIC_CLERK_*` URL vars.
- `.env.local` — add `SANITY_API_READ_TOKEN=` line (value supplied by user).
- `sanity.types.ts` — generated (committed).

## Requirements

- Studio and web are independent workspaces; the Studio is **not** mounted in Next.js.
- Schema relationships fixed by AGENTS.md §8 are exact: `module` is an embedded object
  (not a document); `course` → `instructor` + `category` references + ordered `modules`;
  `module` → ordered `lesson` references; `lesson` stores no parent course.
- No stored display ordinals; numbering derived from order.
- All schema types use the `define*` helpers and carry an icon.
- Read token never reaches the browser bundle; all content fetching is server-side.
- `.env.example` committed and complete; no secrets committed.
- TypeGen runs clean and `client.fetch`/`sanityFetch` are typed via `defineQuery`.

## Security considerations

- `SANITY_API_READ_TOKEN` is server-only (`server-only` import guard, no `NEXT_PUBLIC_`
  prefix, only referenced in `sanity/lib/token.ts` → `live.ts`/`fetch.ts`).
- Dataset is treated as private (AGENTS.md §12) — fetches send the token from the server.
- No write client, no Studio auth code, no Clerk changes in this task.
- `browserToken` in `defineLive` is only exercised under Draft Mode (not enabled here);
  acceptable to pass the same read token, matches `nextjs.md` guidance. Can be dropped to
  `undefined` if we prefer zero token in the browser even for overlays — flagged below.

## Acceptance criteria

- `studio/` runs: `cd studio && npm install && npm run dev` opens Studio at
  `localhost:3333` with Courses / Lessons / Instructors / Categories and a working
  create form for each, including `module` array editing inside a course.
- Creating a course with one module referencing one lesson, one instructor, one category
  saves without validation errors.
- `npm run typegen` (root, delegates to studio) writes `sanity.types.ts` with
  `CATALOG_COURSES_QUERY_RESULT`, `COURSE_BY_SLUG_QUERY_RESULT`,
  `LESSON_BY_SLUG_QUERY_RESULT`, etc.
- Root `npx tsc --noEmit` and `npm run lint` pass; `npm run build` succeeds.
- A scratch server call to `sanityFetch({ query: CATALOG_COURSES_QUERY })` with the token
  set returns the seeded course (proves the read path + private-dataset token).

## Checks to run

Web (repo root):
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

Studio (`studio/`):
- `npm install`
- `npm run typegen` (schema extract + typegen)
- `npx sanity build` (compile check)

Reported with real output. Studio **deploy**, **CORS origin add**, and **content import**
need Sanity login and are listed under "Needs your attention".

## Manual test steps

1. `cd studio && npm install && npm run dev` → open `http://localhost:3333`.
2. Create a **Category** ("Web Development"), an **Instructor** ("Jane Doe" + bio +
   expertise), a **Lesson** ("Intro to Fetching", videoUrl, duration 630, a couple of
   key points, one resource), and a **Course** ("Next.js in Depth") that references the
   instructor + category and has one **Module** ("Getting Started") linking the lesson.
   Publish all.
3. Back at repo root: add `SANITY_API_READ_TOKEN=<viewer token>` to `.env.local`.
4. `npm run typegen` → confirm `sanity.types.ts` regenerates with the query result types.
5. `npm run dev` (web) and hit a temporary route / RSC scratch that calls
   `sanityFetch({ query: COURSE_BY_SLUG_QUERY, params: { slug: "next-js-in-depth" } })`
   → returns the course with `modules[0].lessons[0].title === "Intro to Fetching"` and
   `instructor.name === "Jane Doe"`. Remove the scratch route after.
6. `npx tsc --noEmit`, `npm run lint`, `npm run build` → all green.

## Needs your attention (after approval / during)

- **Read token**: create a **Viewer** token at sanity.io/manage → project `g178ibto` →
  API → Tokens, and paste it into `.env.local` as `SANITY_API_READ_TOKEN`. Fetches 401
  without it if the dataset is private.
- **Studio deploy + CORS** require `npx sanity login` in `studio/`:
  `npx sanity deploy` (needed before the Context MCP will serve the dataset later) and
  `npx sanity cors add http://localhost:3000 --credentials`.
- Confirm you want `browserToken` passed to `defineLive` (enables Visual Editing overlays
  later) or set to `undefined` for zero browser token now.
- `sanity schema extract` flag name (`--force`) is verified against the installed CLI
  during implementation; command adjusted if the CLI differs.
